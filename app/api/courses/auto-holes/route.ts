import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const GOLF_BASE = 'https://api.golfcourseapi.com/v1';

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
function golfHeaders() {
  return { Authorization: `Key ${process.env.GOLF_COURSE_API_KEY ?? ''}` };
}

interface ApiHole { par?: number; yardage?: number; yards?: number; handicap?: number; stroke_index?: number; }
interface ApiTee  { tee_name?: string; name?: string; slope_rating?: number; holes?: ApiHole[]; }

function extractTees(data: Record<string, unknown>): ApiTee[] {
  const root = (data.course as Record<string, unknown> | undefined) ?? data;
  const raw  = root.tees;
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as ApiTee[];
  if (typeof raw === 'object' && raw !== null) {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.male) || Array.isArray(obj.female)) {
      return [
        ...(Array.isArray(obj.male)   ? (obj.male   as ApiTee[]) : []),
        ...(Array.isArray(obj.female) ? (obj.female as ApiTee[]) : []),
      ];
    }
    return Object.entries(obj).map(([k, v]) => ({
      tee_name: k, ...((typeof v === 'object' && v !== null) ? (v as object) : {}),
    })) as ApiTee[];
  }
  return [];
}

// Strip generic suffixes so "Chestnut Hill Country Club" → "Chestnut Hill"
function stripSuffixes(name: string): string {
  const stripped = name
    .replace(/\b(golf\s+(&\s+)?country\s+club|country\s+club|golf\s+course|golf\s+club|golf\s+links|golf\s+resort|links|resort)\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return stripped || name;
}

interface ApiCourse { id: number | string; club_name?: string; location?: { city?: string; state?: string; state_code?: string } | string; city?: string; state?: string; state_code?: string; }

async function searchCourse(term: string): Promise<ApiCourse[]> {
  const res = await fetch(
    `${GOLF_BASE}/search?search_query=${encodeURIComponent(term)}`,
    { headers: golfHeaders() },
  );
  if (!res.ok) return [];
  const data = await res.json();
  return (data.courses ?? []) as ApiCourse[];
}

function courseMatchesLocation(c: ApiCourse, state: string, city: string): boolean {
  const loc = typeof c.location === 'object' && c.location !== null ? c.location : {};
  const cs = (c.state ?? (loc as Record<string,string>).state ?? (loc as Record<string,string>).state_code ?? '').toLowerCase();
  const cc = (c.city  ?? (loc as Record<string,string>).city  ?? '').toLowerCase();
  const s  = state.toLowerCase();
  const ci = city.toLowerCase();
  const stateMatch = !s || cs.includes(s) || s.includes(cs);
  const cityMatch  = !ci || cc.includes(ci) || ci.includes(cc);
  return stateMatch && cityMatch;
}

export async function GET(req: NextRequest) {
  const teeId      = req.nextUrl.searchParams.get('teeId');
  const courseName = req.nextUrl.searchParams.get('courseName') ?? '';
  const teeName    = req.nextUrl.searchParams.get('teeName') ?? '';
  const slope      = Number(req.nextUrl.searchParams.get('slope') ?? 0);
  const state      = req.nextUrl.searchParams.get('state') ?? '';
  const city       = req.nextUrl.searchParams.get('city') ?? '';

  if (!teeId || !courseName) {
    return NextResponse.json({ error: 'missing_params' });
  }
  if (!process.env.GOLF_COURSE_API_KEY) {
    return NextResponse.json({ error: 'no_key' });
  }

  try {
    const strippedName = stripSuffixes(courseName);
    // Try most-specific to least: name+city+state, name+state, name+city, bare name, full name variants
    const candidates = [
      city && state ? `${strippedName} ${city} ${state}` : null,
      state         ? `${strippedName} ${state}` : null,
      city          ? `${strippedName} ${city}` : null,
      strippedName,
      city && state && strippedName !== courseName ? `${courseName} ${city} ${state}` : null,
      strippedName !== courseName ? courseName : null,
    ].filter(Boolean) as string[];

    let courses: ApiCourse[] = [];
    for (const term of candidates) {
      const results = await searchCourse(term);
      if (!results.length) continue;
      // Prefer results that match our state/city
      const located = results.filter(c => courseMatchesLocation(c, state, city));
      courses = located.length ? located : results;
      break;
    }
    if (!courses.length) return NextResponse.json({ error: 'not_found' });

    const detailRes = await fetch(
      `${GOLF_BASE}/courses/${courses[0].id}`,
      { headers: golfHeaders() },
    );
    if (!detailRes.ok) return NextResponse.json({ error: 'api_error' });
    const detailData = await detailRes.json();
    const apiTees    = extractTees(detailData as Record<string, unknown>);
    if (!apiTees.length) return NextResponse.json({ error: 'no_holes' });

    const byName = apiTees.find(t =>
      (t.tee_name ?? t.name ?? '').toLowerCase() === teeName.toLowerCase()
    );
    const bySlope = apiTees
      .filter(t => t.holes?.length)
      .sort((a, b) =>
        Math.abs((a.slope_rating ?? 0) - slope) - Math.abs((b.slope_rating ?? 0) - slope)
      )[0];
    const best = byName ?? bySlope;
    if (!best?.holes?.length) return NextResponse.json({ error: 'no_holes' });

    const holes = best.holes.map((h, i) => ({
      tee_id:      Number(teeId),
      hole_number: i + 1,
      par:         h.par ?? 4,
      yards:       h.yardage ?? h.yards ?? null,
      handicap:    h.handicap ?? h.stroke_index ?? null,
    }));

    await db().from('golf_holes').upsert(holes, { onConflict: 'tee_id,hole_number' });

    return NextResponse.json(holes.map(({ tee_id: _t, ...h }) => h));
  } catch {
    return NextResponse.json({ error: 'api_error' });
  }
}
