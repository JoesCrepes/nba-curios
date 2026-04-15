import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// POST /api/lobbies/[code]/join
// Body: { name: string }
// Adds a new participant to the lobby. Returns { participantId }.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const body = await req.json().catch(() => ({}));
  const name: string = body.name?.trim();

  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  // Verify lobby exists and is still open
  const { data: lobby } = await supabaseAdmin
    .from('lobbies')
    .select('id, status')
    .eq('id', code)
    .single();

  if (!lobby) {
    return NextResponse.json({ error: 'Lobby not found' }, { status: 404 });
  }

  const { data: participant, error } = await supabaseAdmin
    .from('participants')
    .insert({ lobby_id: code, name, is_organizer: false })
    .select('id')
    .single();

  if (error || !participant) {
    return NextResponse.json({ error: 'Failed to join lobby' }, { status: 500 });
  }

  return NextResponse.json({ participantId: participant.id });
}
