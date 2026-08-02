import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { Book } from '../types.ts'

const STATUS_LABEL: Record<string, string> = {
  want_to_read: 'Want to Read',
  reading: 'Reading',
  read: 'Read',
  on_hold: 'On Hold',
  dnf: 'Did Not Finish',
}

export function BookCard({ book, action }: { book: Book; action?: ReactNode }) {
  const authorNames = book.authors.map((a) => a.name).join(', ')
  const formats = [...new Set(book.editions.map((e) => e.format))].filter((f) => f === 'audiobook' || f === 'ebook')

  return (
    <div className="book-card">
      {book.cover_image_url ? (
        <img className="book-cover" src={book.cover_image_url} alt="" />
      ) : (
        <div className="book-cover book-cover--placeholder" />
      )}
      <div className="book-info">
        <Link to={`/books/${book.id}`} className="book-title">
          {book.title}
        </Link>
        {authorNames && <div className="book-authors">{authorNames}</div>}
        <div className="book-meta">
          {formats.map((f) => (
            <span key={f} className={`format-badge format-badge--${f}`}>
              {f}
            </span>
          ))}
          {book.userBook && <span className="status-badge">{STATUS_LABEL[book.userBook.status]}</span>}
        </div>
      </div>
      {action && <div className="book-action">{action}</div>}
    </div>
  )
}
