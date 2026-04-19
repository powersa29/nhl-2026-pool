import { NextRequest, NextResponse } from 'next/server';
import { insertParticipant } from '@/lib/db';
import { PLAYERS, TEAMS } from '@/lib/data';
import type { Pos } from '@/lib/data';

interface Pick { team: string; playerName: string; pos: string; }

function validateRoster(roster: Pick[]): string | null {
  if (!Array.isArray(roster) || roster.length !== 16) return 'Roster must have exactly 16 picks.';

  const teams = new Set<string>();
  const counts: Record<Pos, number> = { G: 0, D: 0, F: 0 };

  for (const pick of roster) {
    if (teams.has(pick.team)) return `Duplicate team: ${pick.team}`;
    teams.add(pick.team);

    const validTeam = TEAMS.some(t => t.abbr === pick.team);
    if (!validTeam) return `Invalid team: ${pick.team}`;

    const player = PLAYERS.find(p => p.name === pick.playerName && p.team === pick.team);
    if (!player) return `Player not found: ${pick.playerName} (${pick.team})`;
    if (player.pos !== pick.pos) return `Position mismatch for ${pick.playerName}`;

    counts[pick.pos as Pos] = (counts[pick.pos as Pos] ?? 0) + 1;
  }

  if (counts.G !== 1) return 'Need exactly 1 goalie.';
  if (counts.D !== 6) return 'Need exactly 6 defensemen.';
  if (counts.F !== 9) return 'Need exactly 9 forwards.';
  return null;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });

  const { name, roster } = body;
  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    return NextResponse.json({ error: 'Name must be at least 2 characters.' }, { status: 400 });
  }

  const validationError = validateRoster(roster);
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

  const { error } = await insertParticipant(name.trim(), roster);
  if (error) return NextResponse.json({ error }, { status: 500 });

  return NextResponse.json({ ok: true });
}
