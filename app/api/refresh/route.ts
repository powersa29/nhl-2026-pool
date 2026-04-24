import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getParticipants, setRankingsSnapshot } from '@/lib/db';
import { fetchAllTeamStats, lookupStats } from '@/lib/nhl-api';
import { TEAMS } from '@/lib/data';

const ADMIN_SECRET = 'buffalosabres';

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret');
  if (secret !== ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Snapshot current rankings before refreshing
  try {
    const [participants, statsMap] = await Promise.all([
      getParticipants(),
      fetchAllTeamStats(TEAMS.map(t => t.abbr)),
    ]);
    const scored = participants.map(p => ({
      id: p.id,
      total: (p.roster ?? []).reduce((sum, pick) => {
        const s = lookupStats(statsMap as never, pick.playerName);
        return sum + (s?.pts ?? 0);
      }, 0),
    }));
    scored.sort((a, b) => b.total - a.total);
    const snapshot: Record<number, number> = {};
    scored.forEach((p, i) => { snapshot[p.id] = i + 1; });
    await setRankingsSnapshot(snapshot);
  } catch (e) {
    console.error('Failed to snapshot rankings:', e);
  }

  revalidatePath('/', 'layout');
  return NextResponse.json({ ok: true, revalidated: new Date().toISOString() });
}
