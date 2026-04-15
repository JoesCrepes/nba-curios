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

interface Pagination {
  page: number;
  per_page: number;
  total: number;
  pages: number;
}

interface ResultsData {
  participants: ParticipantMeta[];
  intersection: IntersectionTrack[];
  pagination: Pagination;
}

interface Props { code: string }

export function ResultsView({ code }: Props) {
  const router = useRouter();
  const [participants, setParticipants] = useState<ParticipantMeta[]>([]);
  const [intersection, setIntersection] = useState<IntersectionTrack[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, per_page: 50, total: 0, pages: 0 });
  const [threshold, setThreshold] = useState(0);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
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

  const fetchResults = useCallback(async (opts: {
    thresh: number;
    pg: number;
    q: string;
    initial?: boolean;
  }) => {
    if (!opts.initial) setFetching(true);
    const params = new URLSearchParams({
      threshold: String(opts.thresh),
      page: String(opts.pg),
      ...(opts.q ? { search: opts.q } : {}),
    });
    const res = await fetch(`/api/lobbies/${code}/results?${params}`);
    if (!res.ok) {
      setError('Failed to load results.');
      setLoading(false);
      setFetching(false);
      return;
    }
    const data: ResultsData = await res.json();
    if (data.participants?.length && !participants.length) {
      setParticipants(data.participants);
    }
    setIntersection(data.intersection ?? []);
    setPagination(data.pagination);
    setLoading(false);
    setFetching(false);
  }, [code, participants.length]);

  // Initial load — default threshold = all participants
  useEffect(() => {
    fetch(`/api/lobbies/${code}/results`)
      .then((r) => r.json())
      .then((data: ResultsData) => {
        const max = data.participants?.length ?? 2;
        setParticipants(data.participants ?? []);
        setIntersection(data.intersection ?? []);
        setPagination(data.pagination);
        setThreshold(max);
        setLoading(false);
      })
      .catch(() => { setError('Failed to load results.'); setLoading(false); });
  }, [code]);

  function debounce(thresh: number, pg: number, q: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchResults({ thresh, pg, q }), 300);
  }

  function handleThresholdChange(val: number) {
    setThreshold(val);
    setPage(1);
    debounce(val, 1, search);
  }

  function handleSearchChange(val: string) {
    setSearch(val);
    setPage(1);
    debounce(threshold, 1, val);
  }

  function handlePageChange(pg: number) {
    setPage(pg);
    fetchResults({ thresh: threshold, pg, q: search });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleCreatePlaylist() {
    if (!session?.participantId) return;
    setCreatingPlaylist(true);
    // Create playlist from ALL matched tracks (not just current page):
    // re-fetch with large limit or use all pages. For simplicity, use current intersection.
    // A full-set playlist fetch could be a separate "export all" action in future.
    const trackIds = intersection.map((e) => e.track.spotify_id);
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
    if (!res.ok) { setError('Failed to create playlist. Make sure your Spotify is connected.'); return; }
    const { playlistUrl: url } = await res.json();
    setPlaylistUrl(url);
  }

  if (loading) {
    return (
      <div className={styles.centered}>
        <div className={styles.spinner} />
        <p style={{ color: 'var(--muted)', marginTop: 16 }}>Loading results…</p>
      </div>
    );
  }

  if (!participants.length) {
    return (
      <div className={styles.centered}>
        <div className="error-banner">{error || 'No connected participants found.'}</div>
        <button className="btn btn-secondary" onClick={() => router.back()} style={{ marginTop: 16 }}>← Back to lobby</button>
      </div>
    );
  }

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

      {/* Participant legend */}
      <div className={`card ${styles.legend}`}>
        {participants.map((p, i) => (
          <span key={p.id} className={styles.legendItem}>
            {p.profile_image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.profile_image_url} alt={p.name} className={styles.legendAvatar} />
            ) : (
              <span className={styles.legendDot} style={{ background: COLORS[i % COLORS.length] }} />
            )}
            <span className={styles.legendName} style={{ color: COLORS[i % COLORS.length] }}>
              {p.name}
            </span>
          </span>
        ))}
      </div>

      {/* Threshold + search controls */}
      <div className={`card ${styles.controls}`}>
        <div className={styles.thresholdRow}>
          <div className={styles.thresholdHeader}>
            <span>Songs liked by at least</span>
            <strong className={styles.thresholdValue}>{threshold} of {maxThreshold}</strong>
            {fetching && <span className={styles.loadingDot}>…</span>}
          </div>
          <input
            type="range"
            min={1}
            max={maxThreshold}
            value={threshold}
            onChange={(e) => handleThresholdChange(Number(e.target.value))}
            className={styles.slider}
          />
        </div>

        <div className={styles.searchRow}>
          <input
            type="text"
            placeholder="Search by song or artist…"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className={styles.searchInput}
          />
          <div className={styles.resultMeta}>
            <span className={styles.resultCount}>
              {pagination.total.toLocaleString()} song{pagination.total !== 1 ? 's' : ''}
            </span>
            {threshold === maxThreshold && !search && <span className={styles.badge}>Exact match</span>}
            {threshold === 1 && !search && <span className={styles.badge}>Everyone&apos;s songs</span>}
          </div>
        </div>
      </div>

      {/* Track list */}
      <div className={`card ${styles.trackList}`}>
        {intersection.length === 0 ? (
          <p className={styles.empty}>
            {search
              ? `No results for "${search}". Try a different search term.`
              : `No songs shared by ${threshold}+ participants. Try lowering the threshold.`}
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

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className={styles.pagination}>
          <button
            className="btn btn-secondary"
            disabled={page <= 1 || fetching}
            onClick={() => handlePageChange(page - 1)}
          >
            ← Prev
          </button>
          <span className={styles.pageInfo}>
            Page {page} of {pagination.pages}
          </span>
          <button
            className="btn btn-secondary"
            disabled={page >= pagination.pages || fetching}
            onClick={() => handlePageChange(page + 1)}
          >
            Next →
          </button>
        </div>
      )}

      {/* Playlist creation */}
      {session?.isOrganizer && intersection.length > 0 && (
        <div className={`card ${styles.playlistCard}`}>
          <h2>Save as Spotify playlist</h2>
          <p className={styles.playlistHint}>
            Creates a playlist on your account.
            {pagination.pages > 1 && ` Currently adds the ${intersection.length} songs on this page — navigate to save all.`}
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
              <button className="btn btn-primary" onClick={handleCreatePlaylist} disabled={creatingPlaylist}>
                {creatingPlaylist ? 'Creating…' : 'Create playlist'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
