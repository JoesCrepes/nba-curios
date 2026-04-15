import type { TrackRef, IntersectionRef } from '@/types';

export interface ParticipantTrackRefs {
  name: string;
  tracks: TrackRef[];
}

export function computeIntersection(
  participants: ParticipantTrackRefs[],
  threshold: number
): IntersectionRef[] {
  const counts = new Map<string, IntersectionRef>();

  for (const participant of participants) {
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
          spotify_id: track.spotify_id,
          // name/artist from first participant who has this track (for search)
          name: track.name ?? '',
          artist: track.artist ?? '',
          count: 1,
          likedBy: [participant.name],
        });
      }
    }
  }

  return [...counts.values()]
    .filter((entry) => entry.count >= threshold)
    .sort((a, b) => b.count - a.count);
}
