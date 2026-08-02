import { Router } from 'express'
import { db } from '../db/connection.js'
import { getFullBook, type UserBookRow } from '../db/repo.js'

export const userBooksRouter = Router()

const VALID_STATUSES = new Set(['want_to_read', 'reading', 'read', 'on_hold', 'dnf'])

userBooksRouter.get('/', (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : undefined
  const rows = (
    status
      ? db.prepare('SELECT book_id FROM user_books WHERE status = ? ORDER BY updated_at DESC').all(status)
      : db.prepare('SELECT book_id FROM user_books ORDER BY updated_at DESC').all()
  ) as { book_id: number }[]

  const books = rows.map((r) => getFullBook(r.book_id)).filter((b) => b !== null)
  res.json({ books })
})

const upsertUserBook = db.prepare(`
  INSERT INTO user_books (book_id, status, preferred_format, rating, review, notes, started_at, finished_at, updated_at)
  VALUES (@book_id, @status, @preferred_format, @rating, @review, @notes, @started_at, @finished_at, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(book_id) DO UPDATE SET
    status = excluded.status,
    preferred_format = excluded.preferred_format,
    rating = excluded.rating,
    review = excluded.review,
    notes = excluded.notes,
    started_at = excluded.started_at,
    finished_at = excluded.finished_at,
    updated_at = excluded.updated_at
`)

// Upsert: add a book to the TBR / update its status, rating, review, notes.
// A book must already be synced locally (via search) before it can be tracked.
userBooksRouter.put('/:bookId', (req, res, next) => {
  try {
    const bookId = Number(req.params.bookId)
    const book = db.prepare('SELECT id FROM books WHERE id = ?').get(bookId)
    if (!book) return res.status(404).json({ error: 'Book not found locally -- search for it first' })

    const body = req.body ?? {}
    if (body.status !== undefined && !VALID_STATUSES.has(body.status)) {
      return res.status(400).json({ error: `status must be one of ${[...VALID_STATUSES].join(', ')}` })
    }

    const existing = db.prepare('SELECT * FROM user_books WHERE book_id = ?').get(bookId) as UserBookRow | undefined

    upsertUserBook.run({
      book_id: bookId,
      status: body.status ?? existing?.status ?? 'want_to_read',
      preferred_format: body.preferred_format ?? existing?.preferred_format ?? null,
      rating: body.rating ?? existing?.rating ?? null,
      review: body.review ?? existing?.review ?? null,
      notes: body.notes ?? existing?.notes ?? null,
      started_at: body.started_at ?? existing?.started_at ?? null,
      finished_at: body.finished_at ?? existing?.finished_at ?? null,
    })

    res.json({ book: getFullBook(bookId) })
  } catch (err) {
    next(err)
  }
})

userBooksRouter.delete('/:bookId', (req, res) => {
  db.prepare('DELETE FROM user_books WHERE book_id = ?').run(Number(req.params.bookId))
  res.status(204).end()
})
