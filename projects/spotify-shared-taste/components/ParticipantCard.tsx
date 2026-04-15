'use client';

import type { Participant } from '@/types';
import styles from './ParticipantCard.module.css';

interface Props {
  participant: Participant;
  isSelf: boolean;
  onConnect?: () => void;
  connecting?: boolean;
}

export function ParticipantCard({ participant, isSelf, onConnect, connecting }: Props) {
  const connected = !!participant.connected_at;

  return (
    <div className={`${styles.card} ${connected ? styles.connected : ''}`}>
      <div className={styles.avatar}>
        {participant.name.charAt(0).toUpperCase()}
      </div>

      <div className={styles.info}>
        <span className={styles.name}>
          {participant.name}
          {participant.is_organizer && <span className={styles.tag}>organizer</span>}
          {isSelf && <span className={styles.tag}>you</span>}
        </span>

        {connected ? (
          <span className={styles.status}>
            <span className={styles.dot} />
            {participant.track_count != null
              ? `${participant.track_count.toLocaleString()} liked songs`
              : 'Connected'}
          </span>
        ) : (
          <span className={`${styles.status} ${styles.waiting}`}>
            <span className={`${styles.dot} ${styles.dotWaiting}`} />
            Not connected
          </span>
        )}
      </div>

      {isSelf && !connected && onConnect && (
        <button
          className="btn btn-primary"
          onClick={onConnect}
          disabled={connecting}
        >
          {connecting ? 'Connecting…' : 'Connect Spotify'}
        </button>
      )}
    </div>
  );
}
