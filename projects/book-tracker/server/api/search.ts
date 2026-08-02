import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getBooksByIds, searchBooks } from '../src/hardcover/client'

/**
 * Stateless POC endpoint -- validates the Hardcover integration only.
 * No database: this doesn't sync/persist anything, just proxies a search
 * so we can eyeball real response shape/content from a phone. The real
 * app's /api/search (server/src/routes/search.ts) does the same lookup
 * plus a local sqlite upsert.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' })

  const q = String(req.query.q ?? '').trim()
  if (!q) return res.status(400).json({ error: 'Missing ?q=' })

  try {
    const ids = await searchBooks(q, { perPage: 8 })
    const books = await getBooksByIds(ids)
    const results = books.map((book) => ({
      hardcoverId: book.id,
      title: book.title,
      subtitle: book.subtitle,
      authors: (book.contributions ?? []).map((c) => c.author?.name).filter((n): n is string => Boolean(n)),
      coverUrl: book.image?.url ?? null,
      editions: (book.editions ?? []).map((e) => ({
        format: e.edition_format,
        readingFormatId: e.reading_format_id,
        audioHours: e.audio_seconds ? Math.round((e.audio_seconds / 3600) * 10) / 10 : null,
        isbn13: e.isbn_13,
        publisher: e.publisher?.name ?? null,
      })),
    }))
    res.status(200).json({ results })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Search failed' })
  }
}
