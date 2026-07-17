import { NextRequest, NextResponse } from 'next/server';
import { insertRound, deleteRound, getOrCreateLeagueForDate, getRoundsForLeague, getRoundsForPlayer, updateHandicap } from '@/lib/golf-db';
import { toDateStr, scoreDifferential, calcHandicapIndex } from '@/lib/golf-scoring';

const ADMIN_TOKEN = 'GlizzyAdmin2026';

export async function GET(req: NextRequest) {
  const leagueId = Number(req.nextUrl.searchParams.get('leagueId'));
  if (!leagueId) return NextResponse.json({ error: 'missing leagueId' }, { status: 400 });
  const rounds = await getRoundsForLeague(leagueId);
  return NextResponse.json(rounds);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { player_id, course_id, tee_id, gross_score, played_at: playedAtRaw, handicap_only, holes: holesRaw } = body;

  if (!player_id || !course_id || !tee_id || !gross_score)
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });

  const holes: 9 | 18 = holesRaw === 18 ? 18 : 9;
  const minScore = holes === 18 ? 36 : 18;
  const maxScore = holes === 18 ? 160 : 72;
  if (gross_score < minScore || gross_score > maxScore)
    return NextResponse.json({ error: `Score must be between ${minScore} and ${maxScore}` }, { status: 400 });

  const playedAt = playedAtRaw ? new Date(playedAtRaw + 'T12:00:00Z') : new Date();
  if (isNaN(playedAt.getTime()))
    return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
  if (playedAt > new Date())
    return NextResponse.json({ error: 'Date cannot be in the future' }, { status: 400 });

  // Handicap-only rounds skip weekly league assignment
  let leagueId: number | null = null;
  if (!handicap_only) {
    const league = await getOrCreateLeagueForDate(playedAt);
    leagueId = league.id;
  }

  const round = await insertRound({
    player_id: Number(player_id),
    course_id: Number(course_id),
    tee_id: Number(tee_id),
    league_id: leagueId,
    gross_score: Number(gross_score),
    holes,
    played_at: toDateStr(playedAt),
  });

  // Recalculate WHS handicap index from all recorded rounds (both competition + handicap-only)
  const allRounds = await getRoundsForPlayer(Number(player_id));
  const diffs = allRounds
    .filter(r => r.golf_tees?.slope_rating && r.golf_tees?.course_rating)
    .map(r => scoreDifferential(
      r.gross_score,
      r.golf_tees!.course_rating,
      r.golf_tees!.slope_rating,
      (r.holes ?? 9) as 9 | 18,
    ));
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
