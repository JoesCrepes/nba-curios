'use client';

import type { IntersectionEntry } from '@/types';
import styles from './TrackRow.module.css';

interface Props {
  entry: IntersectionEntry;
  totalParticipants: number;
  participantNames: string[];
}

// Stable color palette for participant dots
const COLORS = ['#1db954', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export function TrackRow({ entry, totalParticipants, participantNames }: Props) {
  const { track, likedBy, count } = entry;

  return (
    <div className={styles.row}>
      <div className={styles.trackInfo}>
        <span className={styles.name}>{track.name}</span>
        <span className={styles.meta}>
          {track.artists.join(', ')}
          {track.album && (
            <span className={styles.album}> · {track.album}</span>
          )}
        </span>
      </div>

      <div className={styles.right}>
        <div className={styles.dots}>
          {participantNames.map((name, i) => (
            <span
              key={name}
              className={styles.dot}
              style={{
                background: likedBy.includes(name) ? COLORS[i % COLORS.length] : 'var(--border)',
              }}
              title={likedBy.includes(name) ? `${name} likes this` : `${name} doesn't have this`}
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
