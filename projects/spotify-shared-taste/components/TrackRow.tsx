'use client';

import Image from 'next/image';
import type { Track } from '@/types';
import styles from './TrackRow.module.css';

interface Props {
  track: Track;
  count: number;
  likedBy: string[];
  totalParticipants: number;
  participantNames: string[];
}

const COLORS = ['#1db954', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export function TrackRow({ track, count, likedBy, totalParticipants, participantNames }: Props) {
  return (
    <div className={styles.row}>
      {/* Album art */}
      <div className={styles.art}>
        {track.album_art ? (
          <Image
            src={track.album_art}
            alt={track.album}
            width={44}
            height={44}
            className={styles.artImg}
            unoptimized
          />
        ) : (
          <div className={styles.artPlaceholder} />
        )}
      </div>

      {/* Track info */}
      <div className={styles.trackInfo}>
        <span className={styles.name}>{track.name}</span>
        <span className={styles.meta}>
          {track.artists.join(', ')}
          {track.album && <span className={styles.album}> · {track.album}</span>}
        </span>
      </div>

      {/* Participant dots + count */}
      <div className={styles.right}>
        <div className={styles.dots}>
          {participantNames.map((name, i) => (
            <span
              key={name}
              className={styles.dot}
              style={{
                background: likedBy.includes(name) ? COLORS[i % COLORS.length] : 'var(--border)',
              }}
              title={likedBy.includes(name) ? `${name} has this` : `${name} doesn't have this`}
            />
          ))}
        </div>
        <span className={styles.count}>
          {count}/{totalParticipants}
        </span>
      </div>
    </div>
  );
}
