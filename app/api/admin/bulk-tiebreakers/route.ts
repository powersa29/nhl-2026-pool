import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getParticipants, updateParticipant } from '@/lib/db';

const ADMIN_SECRET = 'buffalosabres';

function norm(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret');
  if (secret !== ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!Array.isArray(body?.tiebreakers)) {
    return NextResponse.json({ error: 'Expected { tiebreakers: [{name, tiebreaker}] }' }, { status: 400 });
  }

  const participants = await getParticipants();
  const results: { name: string; matched: string | null; tiebreaker: number | null; status: string }[] = [];

  for (const { name, tiebreaker } of body.tiebreakers) {
    const normName = norm(name);
    const match = participants.find(p => norm(p.name) === normName);
    if (!match) {
      results.push({ name, matched: null, tiebreaker, status: 'no match' });
      continue;
    }
    const tb = tiebreaker === null ? null : Number(tiebreaker);
    const { error } = await updateParticipant(match.id, { tiebreaker: tb });
    results.push({ name, matched: match.name, tiebreaker: tb, status: error ? `error: ${error}` : 'ok' });
  }

  revalidatePath('/', 'layout');
  return NextResponse.json({ results });
}
