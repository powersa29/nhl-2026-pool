import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export async function GET(req: NextRequest) {
  const courseId = Number(req.nextUrl.searchParams.get('courseId'));
  const name  = req.nextUrl.searchParams.get('name')  ?? '';
  const city  = req.nextUrl.searchParams.get('city')  ?? '';
  const state = req.nextUrl.searchParams.get('state') ?? '';
  if (!courseId || !name) return NextResponse.json({ error: 'missing params' }, { status: 400 });

  const q = `${name} golf course ${city} ${state} USA`;
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=3&countrycodes=us`;

  const res = await fetch(url, {
    headers: { 'User-Agent': 'GlizzyGolfLeague/1.0 (contact@glizzygolf.xyz)' },
    next: { revalidate: 86400 },
  });
  if (!res.ok) return NextResponse.json({ error: 'geocode failed' }, { status: 502 });

  const data = await res.json();
  if (!data.length) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const lat = parseFloat(data[0].lat);
  const lng = parseFloat(data[0].lon);

  await db().from('golf_courses').update({ lat, lng }).eq('id', courseId);

  return NextResponse.json({ lat, lng });
}
