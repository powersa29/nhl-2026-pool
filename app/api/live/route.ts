import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

const STALE_MS = 30 * 60 * 1000; // hide after 30 min of no update

export async function GET() {
  const since = new Date(Date.now() - STALE_MS).toISOString();
  const { data } = await db()
    .from('golf_live_locations')
    .select('*')
    .eq('is_active', true)
    .gte('updated_at', since)
    .order('updated_at', { ascending: false });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const { player_id, player_name, course_id, course_name, lat, lng } = await req.json();
  if (!player_id || lat == null || lng == null)
    return NextResponse.json({ error: 'missing fields' }, { status: 400 });

  // Upsert: unique constraint on player_id
  const { data, error } = await db()
    .from('golf_live_locations')
    .upsert({
      player_id,
      player_name: player_name ?? '',
      course_id: course_id ?? null,
      course_name: course_name ?? '',
      lat,
      lng,
      is_active: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'player_id' })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const playerId = Number(req.nextUrl.searchParams.get('playerId'));
  if (!playerId) return NextResponse.json({ error: 'missing playerId' }, { status: 400 });
  await db().from('golf_live_locations').update({ is_active: false }).eq('player_id', playerId);
  return NextResponse.json({ ok: true });
}
