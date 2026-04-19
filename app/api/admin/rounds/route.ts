import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { setRoundsConfig } from '@/lib/db';

const ADMIN_SECRET = 'buffalosabres';

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret');
  if (secret !== ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await req.json();
  if (!Array.isArray(body.rounds)) {
    return NextResponse.json({ error: 'Missing rounds array' }, { status: 400 });
  }
  const { error } = await setRoundsConfig(body.rounds);
  if (error) return NextResponse.json({ error }, { status: 500 });
  revalidatePath('/', 'layout');
  return NextResponse.json({ ok: true });
}
