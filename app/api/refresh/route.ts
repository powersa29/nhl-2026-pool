import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

const ADMIN_SECRET = 'buffalosabres';

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret');
  if (secret !== ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  revalidatePath('/', 'layout');
  return NextResponse.json({ ok: true, revalidated: new Date().toISOString() });
}
