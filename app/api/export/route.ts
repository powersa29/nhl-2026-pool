import { NextResponse } from 'next/server';
import { getParticipants } from '@/lib/db';
import { fetchAllTeamStats, lookupStats } from '@/lib/nhl-api';
import { TEAMS } from '@/lib/data';

export const dynamic = 'force-dynamic';

export async function GET() {
  const [participants, statsMap] = await Promise.all([
    getParticipants(),
    fetchAllTeamStats(TEAMS.map(t => t.abbr)),
  ]);

  const scored = participants.map(p => {
    const total = (p.roster ?? []).reduce((sum, pick) => {
      const s = lookupStats(statsMap as never, pick.playerName);
      return sum + (s?.pts ?? 0);
    }, 0);
    return { name: p.name, total };
  });

  scored.sort((a, b) => b.total - a.total);
  return NextResponse.json(scored);
}
