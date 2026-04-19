import RoundsClient from '@/components/RoundsClient';
import { ROUNDS } from '@/lib/data';
import { getRoundsConfig } from '@/lib/db';

export const revalidate = 300;

export default async function RoundsPage() {
  const saved = await getRoundsConfig().catch(() => null);
  const rounds = (saved && saved.length > 0 ? saved : ROUNDS) as typeof ROUNDS;
  return <RoundsClient rounds={rounds} />;
}
