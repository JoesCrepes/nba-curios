import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// PATCH /api/lobbies/[code]
// Body: { status: 'done' }
// Organizer signals that the search has started; non-organizers poll this and redirect.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const { status } = await req.json().catch(() => ({}));

  if (status !== 'done') {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('lobbies')
    .update({ status })
    .eq('id', code);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

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
