import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { exchangeCode, fetchAllLikedTracks } from '@/lib/spotify';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const stateParam = searchParams.get('state');
  const errorParam = searchParams.get('error');
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL!;

  if (errorParam) {
    console.error('[callback] Spotify returned error:', errorParam);
    return NextResponse.redirect(`${baseUrl}/?error=spotify_denied`);
  }

  if (!code || !stateParam) {
    console.error('[callback] Missing code or state param');
    return NextResponse.redirect(`${baseUrl}/?error=missing_params`);
  }

  let participantId: string;
  let lobbyCode: string;
  let nonce: string;
  try {
    const decoded = JSON.parse(Buffer.from(stateParam, 'base64url').toString('utf-8'));
    participantId = decoded.participantId;
    lobbyCode = decoded.lobbyCode;
    nonce = decoded.nonce;
  } catch (e) {
    console.error('[callback] Failed to decode state:', e);
    return NextResponse.redirect(`${baseUrl}/?error=invalid_state`);
  }

  console.log(`[callback] participant=${participantId} lobby=${lobbyCode}`);

  const { data: nonceRow, error: nonceError } = await supabaseAdmin
    .from('oauth_nonces')
    .select('participant_id, lobby_code')
    .eq('nonce', nonce)
    .eq('participant_id', participantId)
    .single();

  if (nonceError || !nonceRow) {
    console.error('[callback] Nonce validation failed:', nonceError?.message ?? 'not found');
    return NextResponse.redirect(`${baseUrl}/lobby/${lobbyCode}?error=invalid_nonce`);
  }

  await supabaseAdmin.from('oauth_nonces').delete().eq('nonce', nonce);

  let tokens: { access_token: string; refresh_token: string };
  try {
    tokens = await exchangeCode(code);
    console.log('[callback] Token exchange succeeded');
  } catch (e) {
    console.error('[callback] Token exchange failed:', e);
    return NextResponse.redirect(`${baseUrl}/lobby/${lobbyCode}?error=token_exchange_failed`);
  }

  let tracks: Awaited<ReturnType<typeof fetchAllLikedTracks>>;
  try {
    tracks = await fetchAllLikedTracks(tokens.access_token);
    console.log(`[callback] Fetched ${tracks.length} tracks`);
  } catch (e) {
    console.error('[callback] Track fetch failed:', e);
    return NextResponse.redirect(`${baseUrl}/lobby/${lobbyCode}?error=tracks_fetch_failed`);
  }

  const { error: secretError } = await supabaseAdmin
    .from('participant_secrets')
    .upsert({
      participant_id: participantId,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      tracks,
    });

  if (secretError) {
    console.error('[callback] Supabase upsert failed:', secretError.message);
    return NextResponse.redirect(`${baseUrl}/lobby/${lobbyCode}?error=storage_failed`);
  }

  await supabaseAdmin
    .from('participants')
    .update({ connected_at: new Date().toISOString(), track_count: tracks.length })
    .eq('id', participantId);

  console.log(`[callback] Done — participant ${participantId} connected`);
  return NextResponse.redirect(`${baseUrl}/lobby/${lobbyCode}`);
}
