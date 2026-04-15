import type { Track, IntersectionEntry } from '@/types';

export interface ParticipantTracks {
  name: string;
  tracks: Track[];
}

export function computeIntersection(
  participants: ParticipantTracks[],
  threshold: number
): IntersectionEntry[] {
  const counts = new Map<string, IntersectionEntry>();

  for (const participant of participants) {
    // Deduplicate within the same participant (same ISRC from different album versions)
    const seen = new Set<string>();

    for (const track of participant.tracks) {
      const key = track.isrc ?? track.spotify_id;
      if (seen.has(key)) continue;
      seen.add(key);

      const existing = counts.get(key);
      if (existing) {
        existing.count++;
        existing.likedBy.push(participant.name);
      } else {
        counts.set(key, {
          key,
          count: 1,
          track,
          likedBy: [participant.name],
        });
      }
    }
  }

  return [...counts.values()]
    .filter((entry) => entry.count >= threshold)
    .sort((a, b) => b.count - a.count || a.track.name.localeCompare(b.track.name));
}
