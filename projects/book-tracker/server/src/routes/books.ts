import { Router } from 'express'
import { getFullBook } from '../db/repo.js'
import { getBookById } from '../hardcover/client.js'
import { syncBook } from '../hardcover/sync.js'

export const booksRouter = Router()

booksRouter.get('/:id', (req, res) => {
  const book = getFullBook(Number(req.params.id))
  if (!book) return res.status(404).json({ error: 'Not found' })
  res.json({ book })
})

// Re-pull one book from Hardcover (picks up new editions, rating changes to
// metadata, etc.) without a full search round-trip.
booksRouter.post('/:id/resync', async (req, res, next) => {
  try {
    const existing = getFullBook(Number(req.params.id))
    if (!existing || !existing.hardcover_id) return res.status(404).json({ error: 'Not found' })

    const fresh = await getBookById(existing.hardcover_id)
    if (!fresh) return res.status(404).json({ error: 'No longer found on Hardcover' })

    const bookId = syncBook(fresh)
    res.json({ book: getFullBook(bookId) })
  } catch (err) {
    next(err)
  }
})
