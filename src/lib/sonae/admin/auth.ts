/**
 * 管理画面のセッション (Cookie + JWT)。
 *
 * - 認証は `/admin/login` (form) → `/api/admin/login` (POST) で実施
 * - 成功で HS256 署名済 JWT を HttpOnly Cookie にセット
 * - middleware が後続リクエストの Cookie を検証し、無効なら `/admin/login` に redirect
 *
 * カスタム認証 (NextAuth / Auth0 / 自社 SSO 等) に差し替えたい場合、
 * `src/middleware.ts` 内のセッション検証だけ書き換えれば済む。複数 provider を
 * 跨ぐ抽象化はあえて入れていない。
 */

import { jwtVerify, SignJWT } from 'jose';

export const ADMIN_COOKIE_NAME = 'sonae_admin_session';
const DEFAULT_TTL_SECONDS = 60 * 60 * 24; // 24h

export interface AdminEnv {
  user: string;
  password: string;
  secret: Uint8Array;
}

export function readAdminEnv(env: Record<string, string | undefined>): AdminEnv | null {
  const user = env.ADMIN_USER;
  const password = env.ADMIN_PASSWORD;
  const secretRaw = env.ADMIN_JWT_SECRET;
  if (!user || !password || !secretRaw) return null;
  if (secretRaw.length < 32) {
    throw new Error('ADMIN_JWT_SECRET は最低 32 文字必要 (openssl rand -hex 32 等で生成)');
  }
  return { user, password, secret: new TextEncoder().encode(secretRaw) };
}

async function sha256(s: string): Promise<Uint8Array> {
  const buf = new TextEncoder().encode(s);
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return new Uint8Array(digest);
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function verifyLoginCredentials(
  env: AdminEnv,
  given: { user: string; password: string },
): Promise<boolean> {
  const [eu, ep, gu, gp] = await Promise.all([
    sha256(env.user),
    sha256(env.password),
    sha256(given.user),
    sha256(given.password),
  ]);
  return constantTimeEqual(eu, gu) && constantTimeEqual(ep, gp);
}

export async function issueSessionToken(
  env: AdminEnv,
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
): Promise<string> {
  return await new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(env.user)
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(env.secret);
}

export interface SessionPayload {
  sub: string;
  iat: number;
  exp: number;
}

export async function verifySessionToken(
  env: AdminEnv,
  token: string | undefined | null,
): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, env.secret);
    if (!payload.sub || typeof payload.sub !== 'string') return null;
    if (payload.sub !== env.user) return null;
    return payload as SessionPayload;
  } catch {
    return null;
  }
}

export const SESSION_COOKIE_OPTIONS = {
  name: ADMIN_COOKIE_NAME,
  httpOnly: true,
  sameSite: 'strict' as const,
  path: '/',
  secure: process.env.NODE_ENV === 'production',
  maxAge: DEFAULT_TTL_SECONDS,
};
