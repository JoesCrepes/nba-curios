import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { exchangeCode, fetchAllLikedTracks } from '@/lib/spotify';

// GET /api/auth/callback?code=...&state=...
// Handles the Spotify OAuth callback:
//   1. Validates nonce (CSRF check)
//   2. Exchanges auth code for tokens
//   3. Fetches all liked songs
//   4. Stores tokens + tracks in participant_secrets
//   5. Updates participant.connected_at + track_count
//   6. Redirects back to the lobby
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const stateParam = searchParams.get('state');
  const errorParam = searchParams.get('error');
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL!;

  // Handle user denying access
  if (errorParam) {
    return NextResponse.redirect(`${baseUrl}/?error=spotify_denied`);
  }

  if (!code || !stateParam) {
    return NextResponse.redirect(`${baseUrl}/?error=missing_params`);
  }

  // Decode and validate state
  let participantId: string;
  let lobbyCode: string;
  let nonce: string;
  try {
    const decoded = JSON.parse(Buffer.from(stateParam, 'base64url').toString('utf-8'));
    participantId = decoded.participantId;
    lobbyCode = decoded.lobbyCode;
    nonce = decoded.nonce;
  } catch {
    return NextResponse.redirect(`${baseUrl}/?error=invalid_state`);
  }

  // Verify and consume the nonce
  const { data: nonceRow, error: nonceError } = await supabaseAdmin
    .from('oauth_nonces')
    .select('participant_id, lobby_code')
    .eq('nonce', nonce)
    .eq('participant_id', participantId)
    .single();

  if (nonceError || !nonceRow) {
    return NextResponse.redirect(`${baseUrl}/lobby/${lobbyCode}?error=invalid_nonce`);
  }

  // Delete used nonce immediately
  await supabaseAdmin.from('oauth_nonces').delete().eq('nonce', nonce);

  // Exchange auth code for tokens
  let tokens: { access_token: string; refresh_token: string };
  try {
    tokens = await exchangeCode(code);
  } catch {
    return NextResponse.redirect(`${baseUrl}/lobby/${lobbyCode}?error=token_exchange_failed`);
  }

  // Fetch all liked songs (this may take a few seconds for large libraries)
  let tracks: Awaited<ReturnType<typeof fetchAllLikedTracks>>;
  try {
    tracks = await fetchAllLikedTracks(tokens.access_token);
  } catch {
    return NextResponse.redirect(`${baseUrl}/lobby/${lobbyCode}?error=tracks_fetch_failed`);
  }

  // Upsert tokens + tracks into participant_secrets
  const { error: secretError } = await supabaseAdmin
    .from('participant_secrets')
    .upsert({
      participant_id: participantId,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      tracks,
    });

  if (secretError) {
    return NextResponse.redirect(`${baseUrl}/lobby/${lobbyCode}?error=storage_failed`);
  }

  // Mark participant as connected
  await supabaseAdmin
    .from('participants')
    .update({ connected_at: new Date().toISOString(), track_count: tracks.length })
    .eq('id', participantId);

  return NextResponse.redirect(`${baseUrl}/lobby/${lobbyCode}`);
}
