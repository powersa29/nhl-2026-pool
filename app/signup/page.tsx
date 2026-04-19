import BuilderClient from '@/components/BuilderClient';
import { PLAYERS, TEAMS } from '@/lib/data';

export default function SignupPage() {
  return <BuilderClient teams={TEAMS} players={PLAYERS} />;
}
