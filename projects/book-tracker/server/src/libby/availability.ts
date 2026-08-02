import { getAvailability, searchMedia, type ThunderMediaItem } from './client.js'
import { formatQueryParam, hasFormat, type BookFormat } from './formats.js'

export interface AvailabilityResult {
  overdriveTitleId: string
  isOwned: boolean
  isAvailable: boolean
  ownedCopies: number | null
  availableCopies: number | null
  holdsCount: number | null
  estimatedWaitDays: number | null
}

function pickBestMatch(items: ThunderMediaItem[], title: string, format: BookFormat): ThunderMediaItem | null {
  const inFormat = items.filter((item) => hasFormat(item.formats, format))
  const candidates = inFormat.length > 0 ? inFormat : items
  if (candidates.length === 0) return null
  const normalizedTitle = title.trim().toLowerCase()
  const exact = candidates.find((c) => c.title.trim().toLowerCase() === normalizedTitle)
  return exact ?? candidates[0]
}

/** Search one library for a title in a given format and return its availability, or null if no match was found. */
export async function checkAvailability(
  libraryKey: string,
  book: { title: string; author?: string | null },
  format: BookFormat,
): Promise<AvailabilityResult | null> {
  const query = book.author ? `${book.title} ${book.author}` : book.title
  const items = await searchMedia(libraryKey, query, { format: formatQueryParam(format) })
  const match = pickBestMatch(items, book.title, format)
  if (!match) return null

  // Search hits sometimes carry availability counts inline; fall back to
  // the dedicated endpoint when they're missing for precise numbers.
  let { ownedCopies, availableCopies, holdsCount, estimatedWaitDays, isAvailable, isOwned } = match
  if (ownedCopies === undefined || availableCopies === undefined) {
    const avail = await getAvailability(libraryKey, match.id)
    ;({ ownedCopies, availableCopies, holdsCount, estimatedWaitDays, isAvailable, isOwned } = avail)
  }

  return {
    overdriveTitleId: match.id,
    isOwned: isOwned ?? false,
    isAvailable: isAvailable ?? false,
    ownedCopies: ownedCopies ?? null,
    availableCopies: availableCopies ?? null,
    holdsCount: holdsCount ?? null,
    estimatedWaitDays: estimatedWaitDays ?? null,
  }
}
