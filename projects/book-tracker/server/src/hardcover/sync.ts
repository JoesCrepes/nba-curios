import { db } from '../db/connection.js'
import type { HardcoverBook } from './types.js'

type EditionFormat = 'audiobook' | 'ebook' | 'physical' | 'other'

function mapEditionFormat(editionFormat: string | null, readingFormatId: number | null): EditionFormat {
  const f = (editionFormat ?? '').toLowerCase()
  if (f.includes('audiobook') || readingFormatId === 2) return 'audiobook'
  if (f.includes('ebook') || readingFormatId === 4) return 'ebook'
  if (f.includes('hardcover') || f.includes('paperback') || readingFormatId === 1) return 'physical'
  return 'other'
}

const upsertBook = db.prepare(`
  INSERT INTO books (hardcover_id, title, subtitle, description, cover_image_url, release_date, pages, compilation, updated_at)
  VALUES (@hardcover_id, @title, @subtitle, @description, @cover_image_url, @release_date, @pages, @compilation, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(hardcover_id) DO UPDATE SET
    title = excluded.title,
    subtitle = excluded.subtitle,
    description = excluded.description,
    cover_image_url = excluded.cover_image_url,
    release_date = excluded.release_date,
    pages = excluded.pages,
    compilation = excluded.compilation,
    updated_at = excluded.updated_at
`)

const getBookIdByHardcoverId = db.prepare(`SELECT id FROM books WHERE hardcover_id = ?`)

const upsertAuthor = db.prepare(`
  INSERT INTO authors (hardcover_id, name) VALUES (@hardcover_id, @name)
  ON CONFLICT(hardcover_id) DO UPDATE SET name = excluded.name
`)

const getAuthorIdByHardcoverId = db.prepare(`SELECT id FROM authors WHERE hardcover_id = ?`)

const linkBookAuthor = db.prepare(`
  INSERT OR IGNORE INTO book_authors (book_id, author_id, role) VALUES (?, ?, ?)
`)

const upsertEdition = db.prepare(`
  INSERT INTO editions (hardcover_id, book_id, format, isbn_10, isbn_13, asin, audio_seconds, publisher, release_date, narrators)
  VALUES (@hardcover_id, @book_id, @format, @isbn_10, @isbn_13, @asin, @audio_seconds, @publisher, @release_date, @narrators)
  ON CONFLICT(hardcover_id) DO UPDATE SET
    format = excluded.format,
    isbn_10 = excluded.isbn_10,
    isbn_13 = excluded.isbn_13,
    asin = excluded.asin,
    audio_seconds = excluded.audio_seconds,
    publisher = excluded.publisher,
    release_date = excluded.release_date,
    narrators = excluded.narrators
`)

/** Upserts one Hardcover book (+ its authors and editions) into the local db. Returns the local book id. */
export const syncBook = db.transaction((book: HardcoverBook): number => {
  upsertBook.run({
    hardcover_id: book.id,
    title: book.title,
    subtitle: book.subtitle,
    description: book.description,
    cover_image_url: book.image?.url ?? null,
    release_date: book.release_date,
    pages: book.pages,
    compilation: book.compilation ? 1 : 0,
  })
  const bookId = (getBookIdByHardcoverId.get(book.id) as { id: number }).id

  for (const contribution of book.contributions ?? []) {
    const author = contribution.author
    if (!author) continue
    upsertAuthor.run({ hardcover_id: author.id, name: author.name })
    const authorId = (getAuthorIdByHardcoverId.get(author.id) as { id: number }).id
    linkBookAuthor.run(bookId, authorId, 'author')
  }

  for (const edition of book.editions ?? []) {
    const narrators = (edition.contributions ?? [])
      .map((c) => c.author?.name)
      .filter((n): n is string => Boolean(n))
      .join(', ')
    upsertEdition.run({
      hardcover_id: edition.id,
      book_id: bookId,
      format: mapEditionFormat(edition.edition_format, edition.reading_format_id),
      isbn_10: edition.isbn_10,
      isbn_13: edition.isbn_13,
      asin: edition.asin,
      audio_seconds: edition.audio_seconds,
      publisher: edition.publisher?.name ?? null,
      release_date: edition.release_date,
      narrators: narrators || null,
    })
  }

  return bookId
})

export function syncBooks(books: HardcoverBook[]): number[] {
  return books.map((book) => syncBook(book))
}
