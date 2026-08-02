import { useEffect, useState, type FormEvent } from 'react'
import { api } from '../api.ts'
import type { Library } from '../types.ts'

export default function SettingsPage() {
  const [libraries, setLibraries] = useState<Library[]>([])
  const [code, setCode] = useState('')
  const [linking, setLinking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function refresh() {
    api.listLibraries().then(({ libraries }) => setLibraries(libraries))
  }

  useEffect(refresh, [])

  async function linkLibrary(e: FormEvent) {
    e.preventDefault()
    setLinking(true)
    setError(null)
    try {
      await api.linkLibrary(code.trim())
      setCode('')
      refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to link')
    } finally {
      setLinking(false)
    }
  }

  async function removeLibrary(id: number) {
    await api.removeLibrary(id)
    refresh()
  }

  return (
    <div>
      <h1>Settings</h1>

      <section className="panel">
        <h3>Linked Libraries</h3>
        <p className="muted">
          In the Libby app: Settings &gt; "Copy to another device" to get an 8-digit code, then paste it below. This clones
          whatever library cards are already set up in your Libby account -- no password needed here.
        </p>
        <form onSubmit={linkLibrary} className="search-form">
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="8-digit clone code" maxLength={8} inputMode="numeric" />
          <button type="submit" disabled={linking}>
            {linking ? 'Linking…' : 'Link'}
          </button>
        </form>
        {error && <p className="error">{error}</p>}

        {libraries.length === 0 ? (
          <p className="muted">No libraries linked yet.</p>
        ) : (
          <ul className="library-list">
            {libraries.map((lib) => (
              <li key={lib.id}>
                <span>{lib.name}</span>
                <button className="link-button" onClick={() => removeLibrary(lib.id)}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel">
        <h3>Hardcover API</h3>
        <p className="muted">
          Set <code>HARDCOVER_API_TOKEN</code> in <code>server/.env</code> (from your Hardcover account settings page) and restart the
          server. Search won't work until that's set.
        </p>
      </section>
    </div>
  )
}
