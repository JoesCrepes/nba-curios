import { useState, type FormEvent } from 'react'
import { api } from '../api.ts'
import type { Book } from '../types.ts'
import { BookCard } from '../components/BookCard.tsx'

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Book[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searched, setSearched] = useState(false)

  async function runSearch(e: FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    setError(null)
    try {
      const { results } = await api.search(query.trim())
      setResults(results)
      setSearched(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed')
    } finally {
      setLoading(false)
    }
  }

  async function addToTbr(book: Book) {
    const { book: updated } = await api.upsertUserBook(book.id, { status: 'want_to_read' })
    setResults((prev) => prev.map((b) => (b.id === updated.id ? updated : b)))
  }

  return (
    <div>
      <h1>Search</h1>
      <p className="muted">Pulls from Hardcover and syncs matches into your local library.</p>
      <form onSubmit={runSearch} className="search-form">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by title, author, or series..."
          autoFocus
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Searching…' : 'Search'}
        </button>
      </form>
      {error && <p className="error">{error}</p>}
      <div className="book-list">
        {results.map((book) => (
          <BookCard
            key={book.id}
            book={book}
            action={
              book.userBook ? (
                <span className="muted">On your list</span>
              ) : (
                <button onClick={() => addToTbr(book)}>+ Add to TBR</button>
              )
            }
          />
        ))}
      </div>
      {!loading && searched && results.length === 0 && <p className="muted">No results.</p>}
    </div>
  )
}
