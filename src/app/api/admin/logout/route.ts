import { NextResponse } from 'next/server';
import { ADMIN_COOKIE_NAME } from '@/lib/sonae/admin/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: ADMIN_COOKIE_NAME,
    value: '',
    path: '/',
    maxAge: 0,
  });
  return res;
}
