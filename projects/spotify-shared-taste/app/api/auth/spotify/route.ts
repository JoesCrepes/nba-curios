import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { buildAuthUrl } from '@/lib/spotify';

// GET /api/auth/spotify?participantId=...&lobbyCode=...
// Generates a Spotify OAuth URL and redirects the user there.
// A nonce is stored in Supabase to validate on callback (CSRF protection).
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const participantId = searchParams.get('participantId');
  const lobbyCode = searchParams.get('lobbyCode');

  if (!participantId || !lobbyCode) {
    return NextResponse.json(
      { error: 'participantId and lobbyCode are required' },
      { status: 400 }
    );
  }

  // Verify the participant exists in this lobby
  const { data: participant } = await supabaseAdmin
    .from('participants')
    .select('id')
    .eq('id', participantId)
    .eq('lobby_id', lobbyCode)
    .single();

  if (!participant) {
    return NextResponse.json({ error: 'Participant not found' }, { status: 404 });
  }

  // Generate nonce and store it
  const nonce = crypto.randomUUID();
  const { error } = await supabaseAdmin
    .from('oauth_nonces')
    .insert({ nonce, participant_id: participantId, lobby_code: lobbyCode });

  if (error) {
    return NextResponse.json({ error: 'Failed to create auth session' }, { status: 500 });
  }

  // Encode state: participantId + lobbyCode + nonce
  const state = Buffer.from(
    JSON.stringify({ participantId, lobbyCode, nonce })
  ).toString('base64url');

  const authUrl = buildAuthUrl(state);
  return NextResponse.redirect(authUrl);
}
