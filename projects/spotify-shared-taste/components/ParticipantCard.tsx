'use client';

import Image from 'next/image';
import type { Participant } from '@/types';
import styles from './ParticipantCard.module.css';

interface Props {
  participant: Participant;
  isSelf: boolean;
  dotColor?: string;
  onConnect?: () => void;
  connecting?: boolean;
}

export function ParticipantCard({ participant, isSelf, dotColor, onConnect, connecting }: Props) {
  const connected = !!participant.connected_at;

  return (
    <div className={`${styles.card} ${connected ? styles.connected : ''}`}>
      <div className={styles.avatar}>
        {participant.profile_image_url ? (
          <Image
            src={participant.profile_image_url}
            alt={participant.name}
            width={40}
            height={40}
            className={styles.avatarImg}
            unoptimized
          />
        ) : (
          <span className={styles.avatarLetter}>
            {participant.name.charAt(0).toUpperCase()}
          </span>
        )}
        {dotColor && (
          <span className={styles.colorDot} style={{ background: dotColor }} />
        )}
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
              ? `${participant.track_count.toLocaleString()} songs indexed`
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
        <button className="btn btn-primary" onClick={onConnect} disabled={connecting}>
          {connecting ? 'Connecting…' : 'Connect Spotify'}
        </button>
      )}
    </div>
  );
}
