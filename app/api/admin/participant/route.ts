import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { updateParticipant } from '@/lib/db';
import { PLAYERS, TEAMS } from '@/lib/data';
import type { Pos } from '@/lib/data';

const ADMIN_SECRET = 'buffalosabres';

interface Pick { team: string; playerName: string; pos: string; }

function validateRoster(roster: Pick[]): string | null {
  if (!Array.isArray(roster) || roster.length !== 16) return 'Roster must have exactly 16 picks.';
  const teams = new Set<string>();
  const counts: Record<Pos, number> = { G: 0, D: 0, F: 0 };
  for (const pick of roster) {
    if (teams.has(pick.team)) return `Duplicate team: ${pick.team}`;
    teams.add(pick.team);
    if (!TEAMS.some(t => t.abbr === pick.team)) return `Invalid team: ${pick.team}`;
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

export async function PUT(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret');
  if (secret !== ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const fields: { roster?: Pick[]; tiebreaker?: number | null; name?: string } = {};

  if (body.roster !== undefined) {
    const err = validateRoster(body.roster);
    if (err) return NextResponse.json({ error: err }, { status: 400 });
    fields.roster = body.roster;
  }

  if (body.tiebreaker !== undefined) {
    fields.tiebreaker = body.tiebreaker === null ? null : Number(body.tiebreaker);
  }

  if (body.name !== undefined) {
    fields.name = String(body.name).trim();
  }

  const { error } = await updateParticipant(body.id, fields);
  if (error) return NextResponse.json({ error }, { status: 500 });

  revalidatePath('/', 'layout');
  return NextResponse.json({ ok: true });
}
