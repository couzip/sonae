/**
 * 管理画面 (`/admin/*` と `/api/admin/*`) のセッションチェック。
 *
 * 認証方式を差し替えたい場合 (NextAuth / Auth0 / 自社 SSO 等) は、この
 * middleware の `verifySessionToken` 呼び出しだけ差し替えればよい。
 */

import { NextResponse, type NextRequest } from 'next/server';
import {
  ADMIN_COOKIE_NAME,
  readAdminEnv,
  verifySessionToken,
} from '@/lib/sonae/admin/auth';

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};

const PUBLIC_PATHS = new Set<string>(['/admin/login', '/api/admin/login', '/api/admin/logout']);

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  if (PUBLIC_PATHS.has(path)) return NextResponse.next();

  const env = readAdminEnv(process.env as Record<string, string | undefined>);
  if (!env) {
    return new NextResponse(
      'admin disabled: ADMIN_USER / ADMIN_PASSWORD / ADMIN_JWT_SECRET を .env に設定してください',
      { status: 503 },
    );
  }

  const token = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
  const session = await verifySessionToken(env, token);
  if (!session) {
    if (path.startsWith('/api/')) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = '/admin/login';
    url.searchParams.set('next', path + req.nextUrl.search);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}
