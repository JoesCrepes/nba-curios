'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { TrackRow } from './TrackRow';
import type { Track } from '@/types';
import styles from './ResultsView.module.css';

const COLORS = ['#1db954', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

interface ParticipantMeta {
  id: string;
  name: string;
  is_organizer: boolean;
  track_count: number;
  profile_image_url: string | null;
}

interface IntersectionTrack {
  track: Track;
  count: number;
  likedBy: string[];
}

interface ResultsData {
  participants: ParticipantMeta[];
  intersection: IntersectionTrack[];
}

interface Props {
  code: string;
}

export function ResultsView({ code }: Props) {
  const router = useRouter();
  const [data, setData] = useState<ResultsData | null>(null);
  const [threshold, setThreshold] = useState(0);
  const [loading, setLoading] = useState(true);
  const [thresholdLoading, setThresholdLoading] = useState(false);
  const [error, setError] = useState('');
  const [creatingPlaylist, setCreatingPlaylist] = useState(false);
  const [playlistUrl, setPlaylistUrl] = useState('');
  const [playlistName, setPlaylistName] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const session = useMemo(() => {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem(`sst_${code}`);
    if (!raw) return null;
    try { return JSON.parse(raw) as { participantId: string; name: string; isOrganizer: boolean }; }
    catch { return null; }
  }, [code]);

  const fetchResults = useCallback(async (thresh: number, isInitial = false) => {
    if (!isInitial) setThresholdLoading(true);
    const res = await fetch(`/api/lobbies/${code}/results?threshold=${thresh}`);
    if (!res.ok) {
      setError('Failed to load results.');
      setLoading(false);
      setThresholdLoading(false);
      return;
    }
    const json: ResultsData = await res.json();
    setData(json);
    setLoading(false);
    setThresholdLoading(false);
  }, [code]);

  // Initial load — default threshold = all participants
  useEffect(() => {
    fetch(`/api/lobbies/${code}/results`)
      .then((r) => r.json())
      .then((json: ResultsData) => {
        const max = json.participants?.length ?? 2;
        setData(json);
        setThreshold(max);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load results.');
        setLoading(false);
      });
  }, [code]);

  // Debounced threshold change
  function handleThresholdChange(val: number) {
    setThreshold(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchResults(val), 300);
  }

  async function handleCreatePlaylist() {
    if (!session?.participantId || !data) return;
    setCreatingPlaylist(true);
    const trackIds = data.intersection.map((e) => e.track.spotify_id);
    const res = await fetch(`/api/lobbies/${code}/playlist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organizerParticipantId: session.participantId,
        trackIds,
        playlistName: playlistName || undefined,
      }),
    });
    setCreatingPlaylist(false);
    if (!res.ok) {
      setError('Failed to create playlist. Make sure your Spotify is connected.');
      return;
    }
    const { playlistUrl: url } = await res.json();
    setPlaylistUrl(url);
  }

  if (loading) {
    return (
      <div className={styles.centered}>
        <div className={styles.spinner} />
        <p style={{ color: 'var(--muted)', marginTop: 16 }}>
          Fetching and enriching matched songs…
        </p>
      </div>
    );
  }

  if (!data || data.participants.length === 0) {
    return (
      <div className={styles.centered}>
        <div className="error-banner">{error || 'No connected participants found.'}</div>
        <button className="btn btn-secondary" onClick={() => router.back()} style={{ marginTop: 16 }}>
          ← Back to lobby
        </button>
      </div>
    );
  }

  const { participants, intersection } = data;
  const participantNames = participants.map((p) => p.name);
  const maxThreshold = participants.length;

  return (
    <div className="container">
      <div className={styles.header}>
        <button className="btn btn-secondary" onClick={() => router.back()}>← Back</button>
        <div>
          <h1>Shared Songs</h1>
          <p className={styles.subtitle}>
            Lobby <span className={styles.code}>{code}</span> · {participants.length} participants
          </p>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {/* Participant legend with profile photos */}
      <div className={`card ${styles.legend}`}>
        {participants.map((p, i) => (
          <span key={p.id} className={styles.legendItem}>
            {p.profile_image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={p.profile_image_url}
                alt={p.name}
                className={styles.legendAvatar}
              />
            ) : (
              <span
                className={styles.legendDot}
                style={{ background: COLORS[i % COLORS.length] }}
              />
            )}
            <span
              className={styles.legendName}
              style={{ color: COLORS[i % COLORS.length] }}
            >
              {p.name}
            </span>
          </span>
        ))}
      </div>

      {/* Threshold slider */}
      <div className={`card ${styles.thresholdCard}`}>
        <div className={styles.thresholdHeader}>
          <span>Show songs liked by at least</span>
          <strong className={styles.thresholdValue}>
            {threshold} of {maxThreshold}
          </strong>
          <span>participants</span>
          {thresholdLoading && <span className={styles.loadingDot}>…</span>}
        </div>
        <input
          type="range"
          min={1}
          max={maxThreshold}
          value={threshold}
          onChange={(e) => handleThresholdChange(Number(e.target.value))}
          className={styles.slider}
        />
        <div className={styles.thresholdMeta}>
          <span className={styles.resultCount}>
            {intersection.length.toLocaleString()} song{intersection.length !== 1 ? 's' : ''}
          </span>
          {threshold === maxThreshold && <span className={styles.badge}>Exact match</span>}
          {threshold === 1 && <span className={styles.badge}>Everyone&apos;s songs combined</span>}
        </div>
      </div>

      {/* Track list */}
      <div className={`card ${styles.trackList}`}>
        {intersection.length === 0 ? (
          <p className={styles.empty}>
            No songs shared by {threshold}+ participants. Try lowering the threshold.
          </p>
        ) : (
          intersection.map((entry) => (
            <TrackRow
              key={entry.track.spotify_id}
              track={entry.track}
              count={entry.count}
              likedBy={entry.likedBy}
              totalParticipants={maxThreshold}
              participantNames={participantNames}
            />
          ))
        )}
      </div>

      {/* Playlist creation */}
      {session?.isOrganizer && intersection.length > 0 && (
        <div className={`card ${styles.playlistCard}`}>
          <h2>Save as Spotify playlist</h2>
          <p className={styles.playlistHint}>
            Creates a playlist on your account with {intersection.length} songs.
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
