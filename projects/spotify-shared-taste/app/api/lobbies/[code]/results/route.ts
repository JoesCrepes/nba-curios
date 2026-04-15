import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { computeIntersection } from '@/lib/intersection';
import { enrichTracks, refreshAccessToken } from '@/lib/spotify';
import type { TrackRef } from '@/types';

const PER_PAGE = 50;

// GET /api/lobbies/[code]/results?threshold=N&page=P&search=S
// - threshold: min participants who must share a track (default = all connected)
// - page: 1-based page number (default 1)
// - search: case-insensitive filter on track name or artist
//
// Only the current page is enriched via Spotify, keeping API calls to 1 per page load.
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

  if (!lobby) return NextResponse.json({ error: 'Lobby not found' }, { status: 404 });

  // Connected participants (public metadata)
  const { data: participants } = await supabaseAdmin
    .from('participants')
    .select('id, name, is_organizer, track_count, profile_image_url')
    .eq('lobby_id', code)
    .not('connected_at', 'is', null)
    .order('created_at');

  if (!participants || participants.length === 0) {
    return NextResponse.json({ participants: [], intersection: [], pagination: { page: 1, per_page: PER_PAGE, total: 0, pages: 0 } });
  }

  const thresholdParam = searchParams.get('threshold');
  const threshold = thresholdParam
    ? Math.min(Math.max(1, Number(thresholdParam)), participants.length)
    : participants.length;

  const page = Math.max(1, Number(searchParams.get('page') ?? 1));
  const search = (searchParams.get('search') ?? '').trim().toLowerCase();

  // Load minimal track refs + tokens from secrets
  const { data: secrets } = await supabaseAdmin
    .from('participant_secrets')
    .select('participant_id, tracks, access_token, refresh_token')
    .in('participant_id', participants.map((p) => p.id));

  const secretMap = new Map((secrets ?? []).map((s) => [s.participant_id, s]));

  const participantRefs = participants.map((p) => ({
    name: p.name,
    tracks: (secretMap.get(p.id)?.tracks ?? []) as TrackRef[],
  }));

  // Compute full intersection, then filter by search
  let allRefs = computeIntersection(participantRefs, threshold);

  if (search) {
    allRefs = allRefs.filter(
      (r) =>
        r.name.toLowerCase().includes(search) ||
        r.artist.toLowerCase().includes(search)
    );
  }

  const total = allRefs.length;
  const pages = Math.ceil(total / PER_PAGE);
  const pageRefs = allRefs.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  if (pageRefs.length === 0) {
    return NextResponse.json({
      participants,
      intersection: [],
      pagination: { page, per_page: PER_PAGE, total, pages },
    });
  }

  // Enrich only the current page — 1 Spotify batch call for 50 tracks
  let accessToken: string | null = null;
  for (const p of participants) {
    const secret = secretMap.get(p.id);
    if (!secret) continue;
    try {
      const refreshed = await refreshAccessToken(secret.refresh_token);
      accessToken = refreshed.access_token;
      supabaseAdmin
        .from('participant_secrets')
        .update({ access_token: refreshed.access_token })
        .eq('participant_id', p.id)
        .then(() => {});
      break;
    } catch {
      accessToken = secret.access_token;
      break;
    }
  }

  let intersection: { track: import('@/types').Track; count: number; likedBy: string[] }[] = [];

  if (accessToken) {
    const enriched = await enrichTracks(accessToken, pageRefs.map((r) => r.spotify_id));
    const enrichedById = new Map(enriched.map((t) => [t.spotify_id, t]));

    intersection = pageRefs
      .filter((r) => enrichedById.has(r.spotify_id))
      .map((r) => ({
        track: enrichedById.get(r.spotify_id)!,
        count: r.count,
        likedBy: r.likedBy,
      }));
  }

  return NextResponse.json({
    participants,
    intersection,
    pagination: { page, per_page: PER_PAGE, total, pages },
  });
}
