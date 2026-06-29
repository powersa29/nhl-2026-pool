import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateCurrentLeague, countPlayerRoundsThisWeek } from '@/lib/golf-db';

export async function GET(req: NextRequest) {
  const playerId = Number(req.nextUrl.searchParams.get('playerId'));
  if (!playerId) return NextResponse.json({ count: 0 });
  const league = await getOrCreateCurrentLeague();
  const count = await countPlayerRoundsThisWeek(playerId, league.id);
  return NextResponse.json({ count, leagueId: league.id });
}
