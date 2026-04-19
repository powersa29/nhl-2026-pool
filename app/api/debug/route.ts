import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const secret = process.env.NEXT_PUBLIC_ADMIN_SECRET;
  return NextResponse.json({
    hasAdminSecret: !!secret,
    length: secret?.length ?? 0,
    firstChar: secret?.[0] ?? null,
  });
}
