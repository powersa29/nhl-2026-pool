'use client';
import { TEAMS } from '@/lib/data';

export default function TeamChip({ abbr }: { abbr: string }) {
  const t = TEAMS.find(x => x.abbr === abbr);
  return (
    <span className="tchip">
      <span className="dot" style={{ background: t?.color ?? '#888' }} />
      {abbr}
    </span>
  );
}
