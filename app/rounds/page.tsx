import RoundsClient from '@/components/RoundsClient';
import { ROUNDS } from '@/lib/data';

export default function RoundsPage() {
  return <RoundsClient rounds={ROUNDS} />;
}
