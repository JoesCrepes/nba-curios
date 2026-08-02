/**
 * Unofficial Libby/OverDrive client.
 *
 * There is no public developer API for individual accounts -- OverDrive's
 * official "Search API v2" / "Library Availability API" program is gated to
 * library partners. This talks to the same undocumented endpoints the Libby
 * app itself uses, the way community tools do (ping/odmpy, ping/libby-
 * calibre-plugin, notmarek/libbydl). It never touches DRM/download
 * fulfillment -- only account linking and read-only catalog/availability
 * lookups, using your own library card credentials.
 *
 * Auth flow ("clone" a device, same as Libby's own Settings ->
 * "Copy to another device" feature):
 *   1. POST {SENTRY_BASE}/chip            -> anonymous identity token
 *   2. POST {SENTRY_BASE}/chip/clone/code -> links that identity to your
 *      real Libby account using an 8-digit code from the Libby app
 *   3. GET  {SENTRY_BASE}/chip/sync        -> linked library cards
 *
 * Catalog endpoints (thunder.api.overdrive.com) are confirmed against
 * odmpy's overdrive.py (media/{id}, media/bulk, libraries/{key}/media/{id},
 * libraries/{key}/media/{id}/availability). The search-by-query endpoint
 * (libraries/{key}/media?query=...) follows the same /v2/libraries/{key}/
 * shape but its exact query params aren't documented anywhere public --
 * treat searchMedia() as the part most likely to need adjustment against a
 * live account.
 */

const SENTRY_BASE = 'https://sentry-read.svc.overdrive.com'
const THUNDER_BASE = 'https://thunder.api.overdrive.com/v2'

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 11_1) AppleWebKit/537.36 (KHTML, like Gecko) Libby/BookTracker'

export class LibbyError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = 'LibbyError'
  }
}

async function sentryFetch<T>(path: string, opts: { method?: string; token?: string; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = {
    accept: 'application/json',
    'user-agent': USER_AGENT,
  }
  if (opts.body !== undefined) headers['content-type'] = 'application/json'
  if (opts.token) headers.authorization = `Bearer ${opts.token}`

  const res = await fetch(`${SENTRY_BASE}${path}`, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  })
  const json = await parseJsonResponse(res, `${opts.method ?? 'GET'} ${path}`)
  if (!res.ok) {
    throw new LibbyError(`Libby request failed: ${opts.method ?? 'GET'} ${path}`, res.status, json)
  }
  return json as T
}

// OverDrive's endpoints (and anything sitting in front of them, e.g. a
// network proxy or an outage page) don't always return JSON on failure --
// surface the raw body instead of a cryptic "Unexpected token" parse error.
async function parseJsonResponse(res: Response, context: string): Promise<unknown> {
  const text = await res.text()
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    throw new LibbyError(`Non-JSON response from ${context}`, res.status, text.slice(0, 500))
  }
}

async function thunderFetch<T>(path: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
  const url = new URL(`${THUNDER_BASE}${path}`)
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, String(value))
  }
  const res = await fetch(url, {
    headers: { accept: 'application/json', 'user-agent': USER_AGENT },
  })
  const json = await parseJsonResponse(res, `GET ${path}`)
  if (!res.ok) {
    throw new LibbyError(`Thunder request failed: GET ${path}`, res.status, json)
  }
  return json as T
}

/** Step 1: obtain a fresh anonymous identity token. */
export async function getAnonymousIdentity(): Promise<string> {
  const data = await sentryFetch<{ identity: string }>('/chip?client=dewey', { method: 'POST' })
  return data.identity
}

/**
 * Step 2: link an identity token to a real Libby account using the 8-digit
 * code from Libby's app: Settings -> "Copy to another device".
 * Returns the same identity token, now authenticated -- store it.
 */
export async function linkWithCloneCode(identityToken: string, code: string): Promise<void> {
  const normalized = code.replace(/\s+/g, '')
  if (!/^\d{8}$/.test(normalized)) {
    throw new LibbyError('Clone code must be 8 digits (from Libby: Settings -> Copy to another device)')
  }
  await sentryFetch('/chip/clone/code', { method: 'POST', token: identityToken, body: { code: normalized } })
}

export interface LinkedLibrary {
  name: string
  libraryKey: string
  websiteId: number | null
  cardId: string
}

/** Step 3: fetch linked library cards for an authenticated identity token. */
export async function syncLibraries(identityToken: string): Promise<LinkedLibrary[]> {
  const data = await sentryFetch<{
    result: string
    cards?: {
      cardId: string
      cardName?: string
      library?: { websiteId?: number; name?: string; preferredKey?: string; advantageKey?: string }
    }[]
  }>('/chip/sync', { token: identityToken })

  return (data.cards ?? []).map((card) => {
    const library = card.library ?? {}
    const libraryKey = library.preferredKey ?? library.advantageKey ?? (library.websiteId ? String(library.websiteId) : undefined)
    if (!libraryKey) {
      throw new LibbyError(`Could not determine a library key for card ${card.cardId}`, undefined, card)
    }
    return {
      name: library.name ?? card.cardName ?? 'Library',
      libraryKey,
      websiteId: library.websiteId ?? null,
      cardId: card.cardId,
    }
  })
}

export interface ThunderFormat {
  id: string
  name?: string
}

export interface ThunderMediaItem {
  id: string
  title: string
  subtitle?: string
  creators?: { name: string; role?: string }[]
  covers?: { cover150Wide?: { href: string } }
  formats?: ThunderFormat[]
  isOwned?: boolean
  isAvailable?: boolean
  ownedCopies?: number
  availableCopies?: number
  holdsCount?: number
  estimatedWaitDays?: number | null
}

/** Search one library's catalog. Best-effort endpoint -- see module docstring. */
export async function searchMedia(
  libraryKey: string,
  query: string,
  opts: { format?: string; perPage?: number } = {},
): Promise<ThunderMediaItem[]> {
  const data = await thunderFetch<{ items?: ThunderMediaItem[] }>(`/libraries/${libraryKey}/media`, {
    query,
    format: opts.format,
    perPage: opts.perPage ?? 10,
    page: 1,
  })
  return data.items ?? []
}

export interface ThunderAvailability {
  id: string
  isOwned?: boolean
  isAvailable?: boolean
  ownedCopies?: number
  availableCopies?: number
  holdsCount?: number
  estimatedWaitDays?: number | null
  formats?: ThunderFormat[]
}

/** Confirmed endpoint (see odmpy's OverDriveClient.library_media_availability). */
export async function getAvailability(libraryKey: string, titleId: string): Promise<ThunderAvailability> {
  return thunderFetch<ThunderAvailability>(`/libraries/${libraryKey}/media/${titleId}/availability`)
}
