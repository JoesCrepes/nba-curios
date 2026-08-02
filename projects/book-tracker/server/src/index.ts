import cors from 'cors'
import express, { type ErrorRequestHandler } from 'express'
import { config } from './config.js'
import './db/connection.js'
import { searchRouter } from './routes/search.js'
import { booksRouter } from './routes/books.js'
import { userBooksRouter } from './routes/userBooks.js'
import { librariesRouter } from './routes/libraries.js'
import { availabilityRouter } from './routes/availability.js'

const app = express()
app.use(cors())
app.use(express.json())

app.get('/api/health', (_req, res) => res.json({ ok: true }))
app.use('/api/search', searchRouter)
app.use('/api/books/:bookId/availability', availabilityRouter)
app.use('/api/books', booksRouter)
app.use('/api/user-books', userBooksRouter)
app.use('/api/libraries', librariesRouter)

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error(err)
  const message = err instanceof Error ? err.message : 'Internal error'
  const status = message.includes('CHECK constraint failed') || message.includes('NOT NULL constraint') ? 400 : 500
  res.status(status).json({ error: message })
}
app.use(errorHandler)

app.listen(config.port, () => {
  console.log(`book-tracker API listening on http://localhost:${config.port}`)
})
