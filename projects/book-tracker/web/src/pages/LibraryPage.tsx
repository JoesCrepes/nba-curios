import { useEffect, useState } from 'react'
import { api } from '../api.ts'
import type { Book, ReadStatus } from '../types.ts'
import { BookCard } from '../components/BookCard.tsx'

const STATUSES: { value: ReadStatus | ''; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'want_to_read', label: 'Want to Read' },
  { value: 'reading', label: 'Reading' },
  { value: 'read', label: 'Read' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'dnf', label: 'Did Not Finish' },
]

export default function LibraryPage() {
  const [status, setStatus] = useState<ReadStatus | ''>('')
  const [books, setBooks] = useState<Book[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    api
      .listUserBooks(status || undefined)
      .then(({ books }) => setBooks(books))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [status])

  return (
    <div>
      <h1>My Library</h1>
      <div className="filter-row">
        {STATUSES.map((s) => (
          <button
            key={s.value}
            className={s.value === status ? 'chip chip--active' : 'chip'}
            onClick={() => setStatus(s.value)}
          >
            {s.label}
          </button>
        ))}
      </div>
      {error && <p className="error">{error}</p>}
      {loading ? (
        <p className="muted">Loading…</p>
      ) : books.length === 0 ? (
        <p className="muted">Nothing here yet. Go to Search to add something.</p>
      ) : (
        <div className="book-list">
          {books.map((book) => (
            <BookCard key={book.id} book={book} />
          ))}
        </div>
      )}
    </div>
  )
}
