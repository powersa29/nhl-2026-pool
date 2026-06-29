import { NextRequest, NextResponse } from 'next/server';
import { insertRound, deleteRound, getOrCreateLeagueForDate, getRoundsForLeague, getRoundsForPlayer, updateHandicap } from '@/lib/golf-db';
import { toDateStr, scoreDifferential9, calcHandicapIndex } from '@/lib/golf-scoring';

const ADMIN_TOKEN = 'GlizzyAdmin2026';

export async function GET(req: NextRequest) {
  const leagueId = Number(req.nextUrl.searchParams.get('leagueId'));
  if (!leagueId) return NextResponse.json({ error: 'missing leagueId' }, { status: 400 });
  const rounds = await getRoundsForLeague(leagueId);
  return NextResponse.json(rounds);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { player_id, course_id, tee_id, gross_score, played_at: playedAtRaw } = body;

  if (!player_id || !course_id || !tee_id || !gross_score)
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  if (gross_score < 18 || gross_score > 72)
    return NextResponse.json({ error: 'Gross score must be between 18 and 72' }, { status: 400 });

  const playedAt = playedAtRaw ? new Date(playedAtRaw + 'T12:00:00Z') : new Date();
  if (isNaN(playedAt.getTime()))
    return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
  if (playedAt > new Date())
    return NextResponse.json({ error: 'Date cannot be in the future' }, { status: 400 });

  const league = await getOrCreateLeagueForDate(playedAt);

  const round = await insertRound({
    player_id: Number(player_id),
    course_id: Number(course_id),
    tee_id: Number(tee_id),
    league_id: league.id,
    gross_score: Number(gross_score),
    played_at: toDateStr(playedAt),
  });

  // Recalculate WHS handicap index from all recorded rounds
  const allRounds = await getRoundsForPlayer(Number(player_id));
  const diffs = allRounds
    .filter(r => r.golf_tees?.slope_rating && r.golf_tees?.course_rating)
    .map(r => scoreDifferential9(r.gross_score, r.golf_tees!.course_rating, r.golf_tees!.slope_rating));
  const calc = calcHandicapIndex(diffs);
  if (calc) await updateHandicap(Number(player_id), calc.calculatedHI).catch(() => {});

  return NextResponse.json(round, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  if (req.headers.get('x-admin-token') !== ADMIN_TOKEN)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const id = Number(req.nextUrl.searchParams.get('id'));
  if (!id) return NextResponse.json({ error: 'missing id' }, { status: 400 });
  await deleteRound(id);
  return NextResponse.json({ ok: true });
}
