import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getUserProfile, createPlaylist, refreshAccessToken } from '@/lib/spotify';

// POST /api/lobbies/[code]/playlist
// Body: { organizerParticipantId: string, trackIds: string[], playlistName?: string }
// Creates a Spotify playlist on the organizer's account with the provided track IDs.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const body = await req.json().catch(() => ({}));
  const { organizerParticipantId, trackIds, playlistName } = body as {
    organizerParticipantId: string;
    trackIds: string[];
    playlistName?: string;
  };

  if (!organizerParticipantId || !Array.isArray(trackIds) || trackIds.length === 0) {
    return NextResponse.json(
      { error: 'organizerParticipantId and trackIds are required' },
      { status: 400 }
    );
  }

  // Verify the participant is the organizer and belongs to this lobby
  const { data: participant } = await supabaseAdmin
    .from('participants')
    .select('id, name, is_organizer, lobby_id')
    .eq('id', organizerParticipantId)
    .eq('lobby_id', code)
    .single();

  if (!participant || !participant.is_organizer) {
    return NextResponse.json({ error: 'Only the organizer can create a playlist' }, { status: 403 });
  }

  // Get organizer's tokens
  const { data: secrets } = await supabaseAdmin
    .from('participant_secrets')
    .select('access_token, refresh_token')
    .eq('participant_id', organizerParticipantId)
    .single();

  if (!secrets) {
    return NextResponse.json({ error: 'Organizer has not connected Spotify' }, { status: 400 });
  }

  let accessToken = secrets.access_token;

  // Refresh token if needed (always refresh to be safe; Spotify tokens last 1 hour)
  try {
    const refreshed = await refreshAccessToken(secrets.refresh_token);
    accessToken = refreshed.access_token;
    // Update stored token
    await supabaseAdmin
      .from('participant_secrets')
      .update({ access_token: accessToken })
      .eq('participant_id', organizerParticipantId);
  } catch {
    // Use existing token if refresh fails
  }

  // Get organizer's Spotify user ID
  const profile = await getUserProfile(accessToken);
  const name = playlistName ?? `Shared Taste · ${code}`;

  const playlist = await createPlaylist(accessToken, profile.id, name, trackIds);

  return NextResponse.json({ playlistUrl: playlist.external_urls.spotify });
}
