import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// GET /api/lobbies/[code]
// Returns lobby metadata and participant list (no tokens or track data).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;

  const { data: lobby, error: lobbyError } = await supabaseAdmin
    .from('lobbies')
    .select('id, created_at, status')
    .eq('id', code)
    .single();

  if (lobbyError || !lobby) {
    return NextResponse.json({ error: 'Lobby not found' }, { status: 404 });
  }

  const { data: participants } = await supabaseAdmin
    .from('participants')
    .select('id, name, is_organizer, connected_at, track_count')
    .eq('lobby_id', code)
    .order('created_at');

  return NextResponse.json({ lobby, participants: participants ?? [] });
}
