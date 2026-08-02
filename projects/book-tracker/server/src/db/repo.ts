import { db } from './connection.js'

export interface BookRow {
  id: number
  hardcover_id: number | null
  title: string
  subtitle: string | null
  description: string | null
  cover_image_url: string | null
  release_date: string | null
  pages: number | null
  series_name: string | null
  series_position: number | null
  compilation: number
}

export interface EditionRow {
  id: number
  book_id: number
  format: 'audiobook' | 'ebook' | 'physical' | 'other'
  isbn_10: string | null
  isbn_13: string | null
  asin: string | null
  audio_seconds: number | null
  publisher: string | null
  release_date: string | null
  narrators: string | null
}

export interface UserBookRow {
  id: number
  book_id: number
  status: 'want_to_read' | 'reading' | 'read' | 'on_hold' | 'dnf'
  preferred_format: 'audiobook' | 'ebook' | 'physical' | null
  rating: number | null
  review: string | null
  notes: string | null
  started_at: string | null
  finished_at: string | null
  added_at: string
  updated_at: string
}

export interface FullBook extends BookRow {
  authors: { id: number; name: string }[]
  editions: EditionRow[]
  userBook: UserBookRow | null
}

export function getBook(bookId: number): BookRow | undefined {
  return db.prepare('SELECT * FROM books WHERE id = ?').get(bookId) as BookRow | undefined
}

export function getAuthorsForBook(bookId: number): { id: number; name: string }[] {
  return db
    .prepare(
      `SELECT a.id, a.name FROM authors a
       JOIN book_authors ba ON ba.author_id = a.id
       WHERE ba.book_id = ?
       ORDER BY a.name`,
    )
    .all(bookId) as { id: number; name: string }[]
}

export function getEditionsForBook(bookId: number): EditionRow[] {
  return db.prepare('SELECT * FROM editions WHERE book_id = ?').all(bookId) as EditionRow[]
}

export function getUserBook(bookId: number): UserBookRow | undefined {
  return db.prepare('SELECT * FROM user_books WHERE book_id = ?').get(bookId) as UserBookRow | undefined
}

export function getFullBook(bookId: number): FullBook | null {
  const book = getBook(bookId)
  if (!book) return null
  return {
    ...book,
    authors: getAuthorsForBook(bookId),
    editions: getEditionsForBook(bookId),
    userBook: getUserBook(bookId) ?? null,
  }
}
