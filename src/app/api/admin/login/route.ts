import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  ADMIN_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
  issueSessionToken,
  readAdminEnv,
  verifyLoginCredentials,
} from '@/lib/sonae/admin/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  user: z.string().min(1),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  const env = readAdminEnv(process.env as Record<string, string | undefined>);
  if (!env) {
    return NextResponse.json({ error: 'admin disabled' }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }

  const ok = await verifyLoginCredentials(env, parsed.data);
  if (!ok) {
    return NextResponse.json({ error: 'invalid credentials' }, { status: 401 });
  }

  const token = await issueSessionToken(env);
  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    ...SESSION_COOKIE_OPTIONS,
    name: ADMIN_COOKIE_NAME,
    value: token,
  });
  return res;
}
