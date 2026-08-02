import { config } from '../config.js'
import { BOOKS_BY_IDS_QUERY, BOOK_BY_ID_QUERY, SEARCH_BOOKS_QUERY } from './queries.js'
import type { HardcoverBook } from './types.js'

const ENDPOINT = 'https://api.hardcover.app/v1/graphql'

export class HardcoverError extends Error {
  constructor(
    message: string,
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = 'HardcoverError'
  }
}

async function hardcoverRequest<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const token = config.hardcoverToken
  if (!token) throw new HardcoverError('HARDCOVER_API_TOKEN is not set')
  // Hardcover's account page hands out tokens that already include the
  // "Bearer " prefix; accept either form.
  const authorization = token.startsWith('Bearer ') ? token : `Bearer ${token}`

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization,
    },
    body: JSON.stringify({ query, variables }),
  })

  if (!res.ok) {
    throw new HardcoverError(`Hardcover API HTTP ${res.status}`, await res.text())
  }

  const json = (await res.json()) as { data?: T; errors?: unknown }
  if (json.errors) {
    throw new HardcoverError('Hardcover API returned errors', json.errors)
  }
  if (!json.data) {
    throw new HardcoverError('Hardcover API returned no data')
  }
  return json.data
}

/**
 * Search is query-based only -- Hardcover has no server-side format filter,
 * so this just returns candidate book ids in relevance order. Fetch full
 * records with getBooksByIds() and filter client-side on edition format.
 */
export async function searchBooks(query: string, opts: { perPage?: number; page?: number } = {}): Promise<number[]> {
  const { perPage = 20, page = 1 } = opts
  const data = await hardcoverRequest<{ search: { ids: (string | number)[] | null } }>(SEARCH_BOOKS_QUERY, {
    query,
    perPage,
    page,
  })
  const ids = data.search.ids ?? []
  return ids.map((id) => Number(id)).filter((id) => Number.isFinite(id))
}

export async function getBooksByIds(ids: number[]): Promise<HardcoverBook[]> {
  if (ids.length === 0) return []
  const data = await hardcoverRequest<{ books: HardcoverBook[] }>(BOOKS_BY_IDS_QUERY, { ids })
  return data.books
}

export async function getBookById(id: number): Promise<HardcoverBook | null> {
  const data = await hardcoverRequest<{ books_by_pk: HardcoverBook | null }>(BOOK_BY_ID_QUERY, { id })
  return data.books_by_pk
}
