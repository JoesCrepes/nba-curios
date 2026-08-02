import { Router } from 'express'
import { db } from '../db/connection.js'
import { getFullBook } from '../db/repo.js'
import { checkAvailability } from '../libby/availability.js'
import type { BookFormat } from '../libby/formats.js'

// Mounted at /api/books/:bookId/availability -- mergeParams so :bookId
// from the parent mount path is visible here.
export const availabilityRouter = Router({ mergeParams: true })

function getBookId(params: Record<string, unknown>): number {
  return Number((params as { bookId: string }).bookId)
}

const insertCheck = db.prepare(`
  INSERT INTO availability_checks
    (book_id, edition_format, library_id, overdrive_title_id, is_owned, is_available, owned_copies, available_copies, holds_count, estimated_wait_days)
  VALUES (@book_id, @edition_format, @library_id, @overdrive_title_id, @is_owned, @is_available, @owned_copies, @available_copies, @holds_count, @estimated_wait_days)
`)

availabilityRouter.get('/', (req, res) => {
  const bookId = getBookId(req.params)
  const checks = db
    .prepare(
      `SELECT ac.*, l.name AS library_name
       FROM availability_checks ac
       JOIN libraries l ON l.id = ac.library_id
       WHERE ac.book_id = ?
       ORDER BY ac.checked_at DESC`,
    )
    .all(bookId)
  res.json({ checks })
})

// Checks a book's availability, by format, across all (or a chosen subset
// of) linked libraries. The Thunder catalog API is unauthenticated, so this
// only needs each library's key -- no Libby account credentials involved.
availabilityRouter.post('/', async (req, res, next) => {
  try {
    const bookId = getBookId(req.params)
    const format = req.body?.format as BookFormat
    if (format !== 'audiobook' && format !== 'ebook') {
      return res.status(400).json({ error: 'format must be "audiobook" or "ebook"' })
    }

    const book = getFullBook(bookId)
    if (!book) return res.status(404).json({ error: 'Book not found' })

    const requestedIds: number[] | undefined = req.body?.libraryIds
    const libraries = (
      requestedIds && requestedIds.length > 0
        ? db
            .prepare(`SELECT * FROM libraries WHERE is_active = 1 AND id IN (${requestedIds.map(() => '?').join(',')})`)
            .all(...requestedIds)
        : db.prepare('SELECT * FROM libraries WHERE is_active = 1').all()
    ) as { id: number; name: string; library_key: string }[]

    if (libraries.length === 0) {
      return res.status(400).json({ error: 'No linked libraries yet -- link one from Settings first.' })
    }

    const authorNames = book.authors.map((a) => a.name).join(' ')

    const results = []
    for (const library of libraries) {
      try {
        const result = await checkAvailability(library.library_key, { title: book.title, author: authorNames || null }, format)
        insertCheck.run({
          book_id: bookId,
          edition_format: format,
          library_id: library.id,
          overdrive_title_id: result?.overdriveTitleId ?? null,
          is_owned: result ? Number(result.isOwned) : 0,
          is_available: result ? Number(result.isAvailable) : 0,
          owned_copies: result?.ownedCopies ?? null,
          available_copies: result?.availableCopies ?? null,
          holds_count: result?.holdsCount ?? null,
          estimated_wait_days: result?.estimatedWaitDays ?? null,
        })
        results.push({ libraryId: library.id, libraryName: library.name, found: result !== null, ...result })
      } catch (err) {
        results.push({
          libraryId: library.id,
          libraryName: library.name,
          found: false,
          error: err instanceof Error ? err.message : 'Availability check failed',
        })
      }
    }

    res.json({ results })
  } catch (err) {
    next(err)
  }
})
