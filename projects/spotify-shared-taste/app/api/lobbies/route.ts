import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

function generateCode(): string {
  // 6-char alphanumeric code, no ambiguous chars (0/O, 1/I/L)
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// POST /api/lobbies
// Body: { organizerName: string }
// Creates a lobby and the organizer participant. Returns { code, participantId }.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const organizerName: string = body.organizerName?.trim();

  if (!organizerName) {
    return NextResponse.json({ error: 'organizerName is required' }, { status: 400 });
  }

  // Generate a unique lobby code
  let code = '';
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = generateCode();
    const { data } = await supabaseAdmin.from('lobbies').select('id').eq('id', candidate).maybeSingle();
    if (!data) { code = candidate; break; }
  }
  if (!code) {
    return NextResponse.json({ error: 'Could not generate unique code' }, { status: 500 });
  }

  // Create lobby
  const { error: lobbyError } = await supabaseAdmin.from('lobbies').insert({ id: code });
  if (lobbyError) {
    return NextResponse.json({ error: 'Failed to create lobby' }, { status: 500 });
  }

  // Create organizer participant
  const { data: participant, error: participantError } = await supabaseAdmin
    .from('participants')
    .insert({ lobby_id: code, name: organizerName, is_organizer: true })
    .select('id')
    .single();

  if (participantError || !participant) {
    return NextResponse.json({ error: 'Failed to create participant' }, { status: 500 });
  }

  return NextResponse.json({ code, participantId: participant.id });
}
