'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';

export default function LandingPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Pick up ?error= from OAuth callback failures
  if (typeof window !== 'undefined') {
    const err = new URLSearchParams(window.location.search).get('error');
    if (err && !error) setError(`Something went wrong: ${err.replace(/_/g, ' ')}`);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError('');

    const res = await fetch('/api/lobbies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organizerName: name.trim() }),
    });

    if (!res.ok) {
      setError('Failed to create lobby. Please try again.');
      setLoading(false);
      return;
    }

    const { code, participantId } = await res.json();

    // Store session in localStorage so the lobby page knows who we are
    localStorage.setItem(
      `sst_${code}`,
      JSON.stringify({ participantId, name: name.trim(), isOrganizer: true })
    );

    router.push(`/lobby/${code}`);
  }

  return (
    <main className={styles.main}>
      <div className={styles.hero}>
        <div className={styles.icon}>
          <svg viewBox="0 0 24 24" width="48" height="48" fill="none">
            <circle cx="12" cy="12" r="12" fill="#1db954" />
            <path
              d="M17.9 10.9C14.7 9 9.35 8.8 6.3 9.75a1.22 1.22 0 0 1-.66-2.35C9.3 6.2 15.25 6.45 18.95 8.6a1.22 1.22 0 1 1-1.05 2.3zm-.1 3.3a1.02 1.02 0 0 1-1.4.34C14 12.9 10.2 12.6 7.37 13.5a1.02 1.02 0 0 1-.57-1.96c3.25-1 7.5-.75 10.62 1.22a1.02 1.02 0 0 1 .38 1.44zm-1.25 3.15a.81.81 0 0 1-1.12.27C13.58 16.3 11.1 16 8.66 16.53a.81.81 0 0 1-.33-1.58c2.7-.56 5.47-.3 7.95 1.28a.81.81 0 0 1 .27 1.12z"
              fill="#000"
            />
          </svg>
        </div>
        <h1>Shared Taste</h1>
        <p>Find the music your whole group loves. Connect Spotify accounts, see what overlaps.</p>
      </div>

      <div className={`card ${styles.formCard}`}>
        <h2>Start a lobby</h2>
        <p className={styles.hint}>
          You&apos;ll get a shareable link to send to everyone else.
        </p>

        {error && <div className="error-banner">{error}</div>}

        <form onSubmit={handleSubmit} className={styles.form}>
          <label htmlFor="name">Your name</label>
          <input
            id="name"
            type="text"
            placeholder="e.g. Alex"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            required
          />
          <button
            type="submit"
            className="btn btn-primary btn-lg"
            disabled={loading || !name.trim()}
          >
            {loading ? 'Creating…' : 'Create lobby'}
          </button>
        </form>
      </div>

      <p className={styles.footer}>
        Works by reading each person&apos;s liked songs via the Spotify API.
        Nothing is stored beyond your session.
      </p>
    </main>
  );
}
