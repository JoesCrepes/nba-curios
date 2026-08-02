import type { VercelRequest, VercelResponse } from '@vercel/node'
import { checkAvailability } from '../src/libby/availability'
import type { BookFormat } from '../src/libby/formats'

/**
 * Stateless POC endpoint -- validates the Libby/OverDrive catalog lookup
 * only. Takes a library key directly (no account link needed: the Thunder
 * catalog API is public/unauthenticated) so this can be exercised without
 * ever touching a Libby account.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  const { libraryKey, title, author, format } = (req.body ?? {}) as {
    libraryKey?: string
    title?: string
    author?: string
    format?: string
  }
  if (!libraryKey || !title || (format !== 'audiobook' && format !== 'ebook')) {
    return res.status(400).json({ error: 'Body needs { libraryKey, title, author?, format: "audiobook" | "ebook" }' })
  }

  try {
    const result = await checkAvailability(libraryKey, { title, author: author ?? null }, format as BookFormat)
    res.status(200).json({ found: result !== null, ...result })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Availability check failed' })
  }
}
