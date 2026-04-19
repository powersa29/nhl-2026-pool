import RoundsClient from '@/components/RoundsClient';
import { ROUNDS } from '@/lib/data';
import { fetchPlayoffRounds } from '@/lib/nhl-rounds';

export const revalidate = 300;

export default async function RoundsPage() {
  const liveRounds = await fetchPlayoffRounds().catch(() => []);
  // Use live data if we got real series back, otherwise fall back to static
  const rounds = liveRounds.some(r => r.series.length > 0) ? liveRounds : ROUNDS;
  return <RoundsClient rounds={rounds} />;
}
