import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { computeIntersection } from '@/lib/intersection';
import { enrichTracks, refreshAccessToken } from '@/lib/spotify';
import type { TrackRef } from '@/types';

// GET /api/lobbies/[code]/results?threshold=N
// Returns participants metadata + enriched intersection for the given threshold.
// Intersection is computed server-side; only matched tracks are enriched via Spotify API.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const { searchParams } = new URL(req.url);

  const { data: lobby } = await supabaseAdmin
    .from('lobbies')
    .select('id')
    .eq('id', code)
    .single();

  if (!lobby) {
    return NextResponse.json({ error: 'Lobby not found' }, { status: 404 });
  }

  // Load connected participants (public metadata only)
  const { data: participants } = await supabaseAdmin
    .from('participants')
    .select('id, name, is_organizer, track_count, profile_image_url')
    .eq('lobby_id', code)
    .not('connected_at', 'is', null)
    .order('created_at');

  if (!participants || participants.length === 0) {
    return NextResponse.json({ participants: [], intersection: [] });
  }

  const thresholdParam = searchParams.get('threshold');
  const threshold = thresholdParam
    ? Math.min(Math.max(1, Number(thresholdParam)), participants.length)
    : participants.length;

  // Load minimal track refs from secrets table
  const { data: secrets } = await supabaseAdmin
    .from('participant_secrets')
    .select('participant_id, tracks, access_token, refresh_token')
    .in('participant_id', participants.map((p) => p.id));

  const secretMap = new Map(
    (secrets ?? []).map((s) => [s.participant_id, s])
  );

  const participantRefs = participants.map((p) => ({
    name: p.name,
    tracks: (secretMap.get(p.id)?.tracks ?? []) as TrackRef[],
  }));

  // Compute intersection server-side
  const intersectionRefs = computeIntersection(participantRefs, threshold);

  if (intersectionRefs.length === 0) {
    return NextResponse.json({ participants, intersection: [] });
  }

  // Enrich matched tracks with full details using any connected participant's token
  // Prefer refreshing the token to avoid stale access tokens
  let accessToken: string | null = null;
  for (const p of participants) {
    const secret = secretMap.get(p.id);
    if (!secret) continue;
    try {
      const refreshed = await refreshAccessToken(secret.refresh_token);
      accessToken = refreshed.access_token;
      // Update stored token in background (don't await)
      supabaseAdmin
        .from('participant_secrets')
        .update({ access_token: refreshed.access_token })
        .eq('participant_id', p.id)
        .then(() => {});
      break;
    } catch {
      accessToken = secret.access_token; // fall back to stored token
      break;
    }
  }

  let intersection: typeof intersectionRefs extends Array<infer T>
    ? { track: import('@/types').Track; count: number; likedBy: string[] }[]
    : never;

  if (accessToken) {
    const spotifyIds = intersectionRefs.map((r) => r.spotify_id);
    const enriched = await enrichTracks(accessToken, spotifyIds);
    const enrichedById = new Map(enriched.map((t) => [t.spotify_id, t]));

    intersection = intersectionRefs
      .filter((r) => enrichedById.has(r.spotify_id))
      .map((r) => ({
        track: enrichedById.get(r.spotify_id)!,
        count: r.count,
        likedBy: r.likedBy,
      }));
  } else {
    intersection = [];
  }

  return NextResponse.json({ participants, intersection });
}
