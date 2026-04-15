'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { computeIntersection } from '@/lib/intersection';
import { TrackRow } from './TrackRow';
import type { IntersectionEntry } from '@/types';
import styles from './ResultsView.module.css';

interface ParticipantWithTracks {
  id: string;
  name: string;
  is_organizer: boolean;
  track_count: number;
  tracks: {
    isrc: string | null;
    spotify_id: string;
    name: string;
    artists: string[];
    album: string;
  }[];
}

interface Props {
  code: string;
}

export function ResultsView({ code }: Props) {
  const router = useRouter();
  const [participants, setParticipants] = useState<ParticipantWithTracks[]>([]);
  const [threshold, setThreshold] = useState(0); // 0 = not yet set; set after load
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creatingPlaylist, setCreatingPlaylist] = useState(false);
  const [playlistUrl, setPlaylistUrl] = useState('');
  const [playlistName, setPlaylistName] = useState('');

  // Load organizer session from localStorage
  const session = useMemo(() => {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem(`sst_${code}`);
    if (!raw) return null;
    try { return JSON.parse(raw) as { participantId: string; name: string; isOrganizer: boolean }; }
    catch { return null; }
  }, [code]);

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/lobbies/${code}/results`);
      if (!res.ok) {
        setError('Failed to load results.');
        setLoading(false);
        return;
      }
      const data = await res.json();
      setParticipants(data.participants ?? []);
      // Default threshold: all participants
      setThreshold(data.participants?.length ?? 2);
      setLoading(false);
    }
    load();
  }, [code]);

  const participantNames = participants.map((p) => p.name);

  const results: IntersectionEntry[] = useMemo(() => {
    if (participants.length === 0 || threshold === 0) return [];
    return computeIntersection(participants, threshold);
  }, [participants, threshold]);

  async function handleCreatePlaylist() {
    if (!session?.participantId) return;
    setCreatingPlaylist(true);

    const spotifyIds = results.map((e) => e.track.spotify_id);
    const res = await fetch(`/api/lobbies/${code}/playlist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organizerParticipantId: session.participantId,
        trackIds: spotifyIds,
        playlistName: playlistName || undefined,
      }),
    });

    setCreatingPlaylist(false);
    if (!res.ok) {
      setError('Failed to create playlist. Make sure you connected your Spotify.');
      return;
    }

    const { playlistUrl: url } = await res.json();
    setPlaylistUrl(url);
  }

  if (loading) {
    return (
      <div className={styles.centered}>
        <p style={{ color: 'var(--muted)' }}>Loading results…</p>
      </div>
    );
  }

  if (participants.length === 0) {
    return (
      <div className={styles.centered}>
        <div className="error-banner">No connected participants found.</div>
        <button className="btn btn-secondary" onClick={() => router.back()} style={{ marginTop: 16 }}>
          ← Back to lobby
        </button>
      </div>
    );
  }

  return (
    <div className="container">
      <div className={styles.header}>
        <button className="btn btn-secondary" onClick={() => router.back()}>
          ← Back
        </button>
        <div>
          <h1>Shared Songs</h1>
          <p className={styles.subtitle}>
            Lobby <span className={styles.code}>{code}</span> ·{' '}
            {participants.length} participants
          </p>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {/* Participant legend */}
      <div className={`card ${styles.legend}`}>
        {participantNames.map((name, i) => {
          const COLORS = ['#1db954', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
          return (
            <span key={name} className={styles.legendItem}>
              <span
                className={styles.legendDot}
                style={{ background: COLORS[i % COLORS.length] }}
              />
              {name}
            </span>
          );
        })}
      </div>

      {/* Threshold slider */}
      <div className={`card ${styles.thresholdCard}`}>
        <div className={styles.thresholdHeader}>
          <span>Show songs liked by at least</span>
          <strong className={styles.thresholdValue}>
            {threshold} of {participants.length}
          </strong>
          <span>participants</span>
        </div>
        <input
          type="range"
          min={1}
          max={participants.length}
          value={threshold}
          onChange={(e) => setThreshold(Number(e.target.value))}
          className={styles.slider}
        />
        <div className={styles.thresholdMeta}>
          <span className={styles.resultCount}>
            {results.length.toLocaleString()} song{results.length !== 1 ? 's' : ''}
          </span>
          {threshold === participants.length && (
            <span className={styles.badge}>Exact match</span>
          )}
          {threshold === 1 && (
            <span className={styles.badge}>Everyone&apos;s liked songs combined</span>
          )}
        </div>
      </div>

      {/* Results */}
      <div className={`card ${styles.trackList}`}>
        {results.length === 0 ? (
          <p className={styles.empty}>
            No songs liked by {threshold}+ participants. Try lowering the threshold.
          </p>
        ) : (
          results.map((entry) => (
            <TrackRow
              key={entry.key}
              entry={entry}
              totalParticipants={participants.length}
              participantNames={participantNames}
            />
          ))
        )}
      </div>

      {/* Create playlist section */}
      {session?.isOrganizer && results.length > 0 && (
        <div className={`card ${styles.playlistCard}`}>
          <h2>Save as Spotify playlist</h2>
          <p className={styles.playlistHint}>
            Creates a playlist on your Spotify account with {results.length} songs.
          </p>

          {playlistUrl ? (
            <a href={playlistUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
              Open playlist in Spotify ↗
            </a>
          ) : (
            <div className={styles.playlistForm}>
              <input
                type="text"
                placeholder={`Shared Taste · ${code}`}
                value={playlistName}
                onChange={(e) => setPlaylistName(e.target.value)}
              />
              <button
                className="btn btn-primary"
                onClick={handleCreatePlaylist}
                disabled={creatingPlaylist}
              >
                {creatingPlaylist ? 'Creating…' : 'Create playlist'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
