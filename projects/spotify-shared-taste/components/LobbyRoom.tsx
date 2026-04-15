'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';
import { ParticipantCard } from './ParticipantCard';
import type { Participant, LobbyStatus } from '@/types';
import styles from './LobbyRoom.module.css';

const COLORS = ['#1db954', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

interface StoredSession {
  participantId: string;
  name: string;
  isOrganizer: boolean;
}

interface Props { code: string }

export function LobbyRoom({ code }: Props) {
  const router = useRouter();
  const [session, setSession] = useState<StoredSession | null>(null);
  const [joinName, setJoinName] = useState('');
  const [joining, setJoining] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [includePlaylists, setIncludePlaylists] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [lobbyStatus, setLobbyStatus] = useState<LobbyStatus['lobby'] | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const lobbyUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/lobby/${code}` : '';

  useEffect(() => {
    const raw = localStorage.getItem(`sst_${code}`);
    if (raw) {
      try { setSession(JSON.parse(raw)); }
      catch { localStorage.removeItem(`sst_${code}`); }
    }
    const urlError = new URLSearchParams(window.location.search).get('error');
    if (urlError) setError(`Connection failed: ${urlError.replace(/_/g, ' ')}`);
  }, [code]);

  const fetchLobby = useCallback(async () => {
    const res = await fetch(`/api/lobbies/${code}`);
    if (!res.ok) {
      setError('Lobby not found. Check the link and try again.');
      setLoading(false);
      return null;
    }
    const data: LobbyStatus = await res.json();
    setLobbyStatus(data.lobby);
    setParticipants(data.participants);
    setLoading(false);
    return data;
  }, [code]);

  useEffect(() => { fetchLobby(); }, [fetchLobby]);

  // Supabase Realtime — re-fetch on participant changes
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`lobby-${code}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'participants', filter: `lobby_id=eq.${code}` },
        () => { fetchLobby(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [code, fetchLobby]);

  // Non-organizer polling: check lobby status every 3s and auto-redirect when 'done'
  const sessionRef = useRef(session);
  useEffect(() => { sessionRef.current = session; }, [session]);

  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);

    pollRef.current = setInterval(async () => {
      // Only poll if we know we're not the organizer, or session not yet loaded
      if (sessionRef.current?.isOrganizer) return;
      const data = await fetchLobby();
      if (data?.lobby?.status === 'done') {
        clearInterval(pollRef.current!);
        router.push(`/lobby/${code}/results`);
      }
    }, 3000);

    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [code, fetchLobby, router]);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!joinName.trim()) return;
    setJoining(true);
    setError('');
    const res = await fetch(`/api/lobbies/${code}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: joinName.trim() }),
    });
    if (!res.ok) { setError('Failed to join lobby.'); setJoining(false); return; }
    const { participantId } = await res.json();
    const s: StoredSession = { participantId, name: joinName.trim(), isOrganizer: false };
    localStorage.setItem(`sst_${code}`, JSON.stringify(s));
    setSession(s);
    setJoining(false);
  }

  function handleConnectSpotify() {
    if (!session) return;
    setConnecting(true);
    const url = `/api/auth/spotify?participantId=${session.participantId}&lobbyCode=${code}&includePlaylists=${includePlaylists}`;
    window.location.href = url;
  }

  async function handleFindSharedSongs() {
    setLaunching(true);
    // Mark lobby as done so non-organizers auto-redirect via polling
    await fetch(`/api/lobbies/${code}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'done' }),
    });
    router.push(`/lobby/${code}/results`);
  }

  function handleCopyLink() {
    navigator.clipboard.writeText(lobbyUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const selfParticipant = participants.find((p) => p.id === session?.participantId);
  const connectedCount = participants.filter((p) => p.connected_at).length;

  if (loading) {
    return <div className={styles.centered}><p style={{ color: 'var(--muted)' }}>Loading lobby…</p></div>;
  }

  if (error && !lobbyStatus) {
    return <div className={styles.centered}><div className="error-banner">{error}</div></div>;
  }

  return (
    <div className="container">
      <div className={styles.header}>
        <h1>Lobby <span className={styles.code}>{code}</span></h1>
        <p className={styles.subtitle}>{connectedCount}/{participants.length} connected</p>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {/* Share link */}
      <div className={`card ${styles.shareCard}`}>
        <span className={styles.shareLabel}>Invite link</span>
        <span className={styles.shareUrl}>{lobbyUrl}</span>
        <button className="btn btn-secondary" onClick={handleCopyLink}>
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>

      {/* Join form */}
      {!session && (
        <div className={`card ${styles.joinCard}`}>
          <h2>Join this lobby</h2>
          <form onSubmit={handleJoin} className={styles.joinForm}>
            <input
              type="text"
              placeholder="Your name"
              value={joinName}
              onChange={(e) => setJoinName(e.target.value)}
              autoFocus
              required
            />
            <button type="submit" className="btn btn-primary" disabled={joining || !joinName.trim()}>
              {joining ? 'Joining…' : 'Join'}
            </button>
          </form>
        </div>
      )}

      {/* Playlist opt-in toggle — shown when user has joined but not yet connected */}
      {session && !selfParticipant?.connected_at && (
        <div className={styles.playlistToggle}>
          <label className={styles.toggleLabel}>
            <input
              type="checkbox"
              checked={includePlaylists}
              onChange={(e) => setIncludePlaylists(e.target.checked)}
              className={styles.toggleInput}
            />
            <span className={styles.toggleText}>
              Also include songs from my playlists
              <span className={styles.toggleHint}>
                {' '}— songs from playlists you created, not just liked songs
              </span>
            </span>
          </label>
        </div>
      )}

      {/* Participant list */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Participants</h2>
        <div className={styles.participantList}>
          {participants.map((p, i) => (
            <ParticipantCard
              key={p.id}
              participant={p}
              isSelf={p.id === session?.participantId}
              dotColor={COLORS[i % COLORS.length]}
              onConnect={handleConnectSpotify}
              connecting={connecting}
            />
          ))}
          {participants.length === 0 && (
            <p style={{ color: 'var(--muted)', fontSize: 14 }}>No participants yet.</p>
          )}
        </div>
      </div>

      {/* Organizer controls */}
      {session?.isOrganizer && (
        <div className={styles.controls}>
          <button
            className="btn btn-primary btn-lg"
            disabled={connectedCount < 2 || launching}
            onClick={handleFindSharedSongs}
          >
            {launching ? 'Starting…' : 'Find shared songs →'}
          </button>
          {connectedCount < 2 && (
            <p className={styles.hint}>At least 2 people need to connect their Spotify first.</p>
          )}
        </div>
      )}

      {/* Non-organizer: waiting message */}
      {session && !session.isOrganizer && (
        <div className={styles.waitingMsg}>
          {selfParticipant?.connected_at ? (
            <p>You&apos;re connected! Waiting for the organizer to start the search…</p>
          ) : (
            <p>Join the lobby above, then connect your Spotify to get started.</p>
          )}
        </div>
      )}
    </div>
  );
}
