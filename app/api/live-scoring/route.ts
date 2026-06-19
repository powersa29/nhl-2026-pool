import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendPushToAll } from '@/lib/push';

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

const SIX_HOURS = 6 * 60 * 60 * 1000;

export async function GET() {
  const cutoff = new Date(Date.now() - SIX_HOURS).toISOString();
  const { data } = await db()
    .from('live_rounds')
    .select('*')
    .eq('is_active', true)
    .gte('updated_at', cutoff)
    .order('started_at', { ascending: false });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { player_id, player_name, course_id, course_name, tee_name,
          slope_rating, course_rating, handicap_index, start_hole, hole_pars } = body;

  if (!player_name || !course_name || !tee_name || !slope_rating || !course_rating)
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });

  if (player_id) {
    await db().from('live_rounds').update({ is_active: false })
      .eq('player_id', player_id).eq('is_active', true);
  }

  const { data, error } = await db()
    .from('live_rounds')
    .insert({
      player_id, player_name, course_id, course_name, tee_name,
      slope_rating, course_rating, handicap_index,
      start_hole: start_hole ?? 1,
      hole_pars:  hole_pars  ?? [],
      scores: [],
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  sendPushToAll(
    {
      title: `${player_name} is on the course!`,
      body:  `Live at ${course_name} — follow along now`,
      url:   '/live',
    },
    { excludePlayerId: player_id ? Number(player_id) : undefined },
  ).catch(() => {});

  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const { id, scores, pin_lat, pin_lng, pin_hole } = await req.json();
  if (!id) return NextResponse.json({ error: 'missing id' }, { status: 400 });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (scores !== undefined) patch.scores = scores;
  if (pin_lat !== undefined) patch.pin_lat = pin_lat;
  if (pin_lng !== undefined) patch.pin_lng = pin_lng;
  if (pin_hole !== undefined) patch.pin_hole = pin_hole;

  const { data, error } = await db()
    .from('live_rounds')
    .update(patch)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const id = Number(req.nextUrl.searchParams.get('id'));
  if (!id) return NextResponse.json({ error: 'missing id' }, { status: 400 });
  await db().from('live_rounds').update({ is_active: false }).eq('id', id);
  return NextResponse.json({ ok: true });
}
