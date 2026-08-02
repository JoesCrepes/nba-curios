import { Router } from 'express'
import { getBooksByIds, searchBooks } from '../hardcover/client.js'
import { syncBooks } from '../hardcover/sync.js'
import { getFullBook } from '../db/repo.js'

export const searchRouter = Router()

// Search Hardcover, sync the candidates into the local db, and return them
// in our own shape. Hardcover's search is query-only (no format filter), so
// this pulls candidates and the UI filters client-side on edition format.
searchRouter.get('/', async (req, res, next) => {
  try {
    const q = String(req.query.q ?? '').trim()
    if (!q) return res.json({ results: [] })

    const ids = await searchBooks(q, { perPage: 15 })
    const hardcoverBooks = await getBooksByIds(ids)
    const localIds = syncBooks(hardcoverBooks)
    const results = localIds.map((id) => getFullBook(id)).filter((b) => b !== null)
    res.json({ results })
  } catch (err) {
    next(err)
  }
})
