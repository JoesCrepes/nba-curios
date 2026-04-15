import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import type { Track } from '@/types';

// GET /api/lobbies/[code]/results
// Returns all connected participants with their track lists for client-side intersection.
// Track data is pulled from participant_secrets (server-only table).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;

  // Verify lobby exists
  const { data: lobby } = await supabaseAdmin
    .from('lobbies')
    .select('id, status')
    .eq('id', code)
    .single();

  if (!lobby) {
    return NextResponse.json({ error: 'Lobby not found' }, { status: 404 });
  }

  // Get all connected participants
  const { data: participants } = await supabaseAdmin
    .from('participants')
    .select('id, name, is_organizer, track_count')
    .eq('lobby_id', code)
    .not('connected_at', 'is', null)
    .order('created_at');

  if (!participants || participants.length === 0) {
    return NextResponse.json({ participants: [] });
  }

  // Fetch each participant's tracks from secrets table
  const participantIds = participants.map((p) => p.id);
  const { data: secrets } = await supabaseAdmin
    .from('participant_secrets')
    .select('participant_id, tracks')
    .in('participant_id', participantIds);

  const secretsByParticipantId = new Map(
    (secrets ?? []).map((s) => [s.participant_id, s.tracks as Track[]])
  );

  const result = participants.map((p) => ({
    id: p.id,
    name: p.name,
    is_organizer: p.is_organizer,
    track_count: p.track_count,
    tracks: secretsByParticipantId.get(p.id) ?? [],
  }));

  return NextResponse.json({ participants: result });
}
