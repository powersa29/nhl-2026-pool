import { NextRequest, NextResponse } from 'next/server';
import { getParticipants } from '@/lib/db';

const ADMIN_SECRET = 'buffalosabres';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret');
  if (secret !== ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const participants = await getParticipants();
  return NextResponse.json(participants.map(p => ({
    id: p.id,
    name: p.name,
    created_at: p.created_at,
    picks: (p.roster ?? []).length,
    tiebreaker: p.tiebreaker ?? null,
  })));
}
