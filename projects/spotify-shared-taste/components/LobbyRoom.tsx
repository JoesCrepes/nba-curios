'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';
import { ParticipantCard } from './ParticipantCard';
import type { Participant, LobbyStatus } from '@/types';
import styles from './LobbyRoom.module.css';

interface StoredSession {
  participantId: string;
  name: string;
  isOrganizer: boolean;
}

interface Props {
  code: string;
}

export function LobbyRoom({ code }: Props) {
  const router = useRouter();
  const [session, setSession] = useState<StoredSession | null>(null);
  const [joinName, setJoinName] = useState('');
  const [joining, setJoining] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [lobbyStatus, setLobbyStatus] = useState<LobbyStatus['lobby'] | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const lobbyUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/lobby/${code}` : '';

  // Load session from localStorage
  useEffect(() => {
    const raw = localStorage.getItem(`sst_${code}`);
    if (raw) {
      try {
        setSession(JSON.parse(raw));
      } catch {
        localStorage.removeItem(`sst_${code}`);
      }
    }
    // Check for error from OAuth callback
    const urlError = new URLSearchParams(window.location.search).get('error');
    if (urlError) setError(`Connection failed: ${urlError.replace(/_/g, ' ')}`);
  }, [code]);

  const fetchLobby = useCallback(async () => {
    const res = await fetch(`/api/lobbies/${code}`);
    if (!res.ok) {
      setError('Lobby not found. Check the link and try again.');
      setLoading(false);
      return;
    }
    const data: LobbyStatus = await res.json();
    setLobbyStatus(data.lobby);
    setParticipants(data.participants);
    setLoading(false);
  }, [code]);

  useEffect(() => {
    fetchLobby();
  }, [fetchLobby]);

  // Subscribe to Realtime updates on participants table
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`lobby-${code}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'participants', filter: `lobby_id=eq.${code}` },
        () => {
          // Re-fetch on any change (INSERT or UPDATE)
          fetchLobby();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [code, fetchLobby]);

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

    if (!res.ok) {
      setError('Failed to join lobby.');
      setJoining(false);
      return;
    }

    const { participantId } = await res.json();
    const s: StoredSession = { participantId, name: joinName.trim(), isOrganizer: false };
    localStorage.setItem(`sst_${code}`, JSON.stringify(s));
    setSession(s);
    setJoining(false);
  }

  function handleConnectSpotify() {
    if (!session) return;
    setConnecting(true);
    window.location.href = `/api/auth/spotify?participantId=${session.participantId}&lobbyCode=${code}`;
  }

  function handleCopyLink() {
    navigator.clipboard.writeText(lobbyUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const selfParticipant = participants.find((p) => p.id === session?.participantId);
  const connectedCount = participants.filter((p) => p.connected_at).length;
  const allConnected = participants.length > 0 && connectedCount === participants.length;

  if (loading) {
    return (
      <div className={styles.centered}>
        <p style={{ color: 'var(--muted)' }}>Loading lobby…</p>
      </div>
    );
  }

  if (error && !lobbyStatus) {
    return (
      <div className={styles.centered}>
        <div className="error-banner">{error}</div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className={styles.header}>
        <h1>
          Lobby <span className={styles.code}>{code}</span>
        </h1>
        <p className={styles.subtitle}>
          {connectedCount}/{participants.length} connected
        </p>
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

      {/* Join form — shown if not in session yet */}
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
            <button
              type="submit"
              className="btn btn-primary"
              disabled={joining || !joinName.trim()}
            >
              {joining ? 'Joining…' : 'Join'}
            </button>
          </form>
        </div>
      )}

      {/* Participant list */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Participants</h2>
        <div className={styles.participantList}>
          {participants.map((p) => (
            <ParticipantCard
              key={p.id}
              participant={p}
              isSelf={p.id === session?.participantId}
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
            disabled={connectedCount < 2}
            onClick={() => router.push(`/lobby/${code}/results`)}
          >
            Find shared songs →
          </button>
          {connectedCount < 2 && (
            <p className={styles.hint}>
              At least 2 people need to connect their Spotify first.
            </p>
          )}
          {allConnected && connectedCount >= 2 && (
            <p className={styles.hint} style={{ color: 'var(--accent)' }}>
              Everyone&apos;s connected — ready to go!
            </p>
          )}
        </div>
      )}

      {/* Non-organizer waiting state */}
      {session && !session.isOrganizer && selfParticipant?.connected_at && (
        <div className={styles.waitingMsg}>
          <p>
            You&apos;re connected! Waiting for the organizer to start the search…
          </p>
        </div>
      )}
    </div>
  );
}
