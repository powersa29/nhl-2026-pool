import { NextResponse } from 'next/server';
import { fetchScores, todayDate, yesterdayDate } from '@/lib/nhl-scores';

export const dynamic = 'force-dynamic';

export async function GET() {
  const today = todayDate();
  const todayGames = await fetchScores(today);

  if (todayGames.length > 0) {
    const hasLive = todayGames.some(g => g.state === 'LIVE');
    return NextResponse.json({ games: todayGames, date: today, live: hasLive });
  }

  const yesterday = yesterdayDate();
  const yGames = await fetchScores(yesterday);
  return NextResponse.json({ games: yGames, date: yesterday, live: false });
}
