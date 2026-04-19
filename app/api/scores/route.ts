import { NextResponse } from 'next/server';
import { fetchAllTeamStats } from '@/lib/nhl-api';
import { TEAMS } from '@/lib/data';

export const revalidate = 600;

export async function GET() {
  const statsMap = await fetchAllTeamStats(TEAMS.map(t => t.abbr));
  return NextResponse.json(statsMap);
}
