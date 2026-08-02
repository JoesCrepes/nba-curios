import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../api.ts'
import type { AvailabilityResult, Book, BookFormat, Library, ReadStatus, UserBook } from '../types.ts'

const STATUS_OPTIONS: ReadStatus[] = ['want_to_read', 'reading', 'read', 'on_hold', 'dnf']
const RATING_OPTIONS = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5]

export default function BookDetailPage() {
  const { id } = useParams()
  const bookId = Number(id)
  const [book, setBook] = useState<Book | null>(null)
  const [libraries, setLibraries] = useState<Library[]>([])
  const [availability, setAvailability] = useState<AvailabilityResult[]>([])
  const [checking, setChecking] = useState<BookFormat | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.getBook(bookId).then(({ book }) => setBook(book))
    api.listLibraries().then(({ libraries }) => setLibraries(libraries))
  }, [bookId])

  async function updateUserBook(patch: Partial<UserBook>) {
    setSaving(true)
    setError(null)
    try {
      const { book: updated } = await api.upsertUserBook(bookId, patch)
      setBook(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  async function runAvailabilityCheck(format: BookFormat) {
    setChecking(format)
    setError(null)
    try {
      const { results } = await api.checkAvailability(bookId, format)
      setAvailability(results)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Availability check failed')
    } finally {
      setChecking(null)
    }
  }

  if (!book) return <p className="muted">Loading…</p>

  const availableFormats = [...new Set(book.editions.map((e) => e.format))].filter(
    (f): f is BookFormat => f === 'audiobook' || f === 'ebook',
  )
  const audioEdition = book.editions.find((e) => e.format === 'audiobook' && e.audio_seconds)
  const authorNames = book.authors.map((a) => a.name).join(', ')

  return (
    <div className="book-detail">
      <div className="book-detail__header">
        {book.cover_image_url && <img src={book.cover_image_url} alt="" className="book-cover book-cover--lg" />}
        <div>
          <h1>{book.title}</h1>
          {book.subtitle && <h2 className="muted">{book.subtitle}</h2>}
          {authorNames && <p>{authorNames}</p>}
          {book.series_name && (
            <p className="muted">
              {book.series_name}
              {book.series_position ? ` #${book.series_position}` : ''}
            </p>
          )}
          {audioEdition?.audio_seconds && <p className="muted">{Math.round(audioEdition.audio_seconds / 3600)} hr audiobook</p>}
        </div>
      </div>

      {book.description && <p className="book-description">{book.description}</p>}

      <section className="panel">
        <h3>Tracking</h3>
        <div className="tracking-form">
          <label>
            Status
            <select
              value={book.userBook?.status ?? 'want_to_read'}
              disabled={saving}
              onChange={(e) => updateUserBook({ status: e.target.value as ReadStatus })}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </label>
          <label>
            Rating
            <select
              value={book.userBook?.rating ?? ''}
              disabled={saving}
              onChange={(e) => updateUserBook({ rating: e.target.value ? Number(e.target.value) : null })}
            >
              <option value="">--</option>
              {RATING_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {r} / 5
                </option>
              ))}
            </select>
          </label>
          <label>
            Preferred format
            <select
              value={book.userBook?.preferred_format ?? ''}
              disabled={saving}
              onChange={(e) => updateUserBook({ preferred_format: (e.target.value || null) as UserBook['preferred_format'] })}
            >
              <option value="">--</option>
              <option value="audiobook">Audiobook</option>
              <option value="ebook">Ebook</option>
              <option value="physical">Physical</option>
            </select>
          </label>
        </div>
        <label className="block-label">
          Notes
          <textarea defaultValue={book.userBook?.notes ?? ''} onBlur={(e) => updateUserBook({ notes: e.target.value })} rows={3} />
        </label>
      </section>

      <section className="panel">
        <h3>Libby Availability</h3>
        {libraries.length === 0 ? (
          <p className="muted">No libraries linked yet. Go to Settings to link one.</p>
        ) : availableFormats.length === 0 ? (
          <p className="muted">No audiobook or ebook edition on file for this book yet.</p>
        ) : (
          <>
            <div className="filter-row">
              {availableFormats.map((format) => (
                <button key={format} disabled={checking !== null} onClick={() => runAvailabilityCheck(format)}>
                  {checking === format ? 'Checking…' : `Check ${format} availability`}
                </button>
              ))}
            </div>
            {availability.length > 0 && (
              <table className="availability-table">
                <thead>
                  <tr>
                    <th>Library</th>
                    <th>Status</th>
                    <th>Copies</th>
                    <th>Holds</th>
                    <th>Est. wait</th>
                  </tr>
                </thead>
                <tbody>
                  {availability.map((r) => (
                    <tr key={r.libraryId}>
                      <td>{r.libraryName}</td>
                      <td>
                        {r.error
                          ? `Error: ${r.error}`
                          : !r.found
                            ? 'Not found'
                            : r.isAvailable
                              ? 'Available now'
                              : r.isOwned
                                ? 'On hold list'
                                : 'Not owned'}
                      </td>
                      <td>
                        {r.availableCopies ?? '--'} / {r.ownedCopies ?? '--'}
                      </td>
                      <td>{r.holdsCount ?? '--'}</td>
                      <td>{r.estimatedWaitDays != null ? `${r.estimatedWaitDays}d` : '--'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </section>

      {error && <p className="error">{error}</p>}
    </div>
  )
}
