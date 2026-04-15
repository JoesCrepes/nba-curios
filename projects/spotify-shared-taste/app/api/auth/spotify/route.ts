import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { buildAuthUrl } from '@/lib/spotify';

// GET /api/auth/spotify?participantId=...&lobbyCode=...&includePlaylists=true
// Generates a Spotify OAuth URL with a signed state and redirects the user.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const participantId = searchParams.get('participantId');
  const lobbyCode = searchParams.get('lobbyCode');
  const includePlaylists = searchParams.get('includePlaylists') === 'true';

  if (!participantId || !lobbyCode) {
    return NextResponse.json(
      { error: 'participantId and lobbyCode are required' },
      { status: 400 }
    );
  }

  const { data: participant } = await supabaseAdmin
    .from('participants')
    .select('id')
    .eq('id', participantId)
    .eq('lobby_id', lobbyCode)
    .single();

  if (!participant) {
    return NextResponse.json({ error: 'Participant not found' }, { status: 404 });
  }

  const nonce = crypto.randomUUID();
  const { error } = await supabaseAdmin
    .from('oauth_nonces')
    .insert({ nonce, participant_id: participantId, lobby_code: lobbyCode });

  if (error) {
    return NextResponse.json({ error: 'Failed to create auth session' }, { status: 500 });
  }

  const state = Buffer.from(
    JSON.stringify({ participantId, lobbyCode, nonce, includePlaylists })
  ).toString('base64url');

  return NextResponse.redirect(buildAuthUrl(state));
}
