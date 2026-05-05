import { describe, expect, it } from 'vitest';
import {
  issueSessionToken,
  readAdminEnv,
  verifyLoginCredentials,
  verifySessionToken,
} from './auth';

const VALID_SECRET = 'a'.repeat(64);

describe('readAdminEnv', () => {
  it('returns null when any field is missing', () => {
    expect(readAdminEnv({})).toBeNull();
    expect(readAdminEnv({ ADMIN_USER: 'x' })).toBeNull();
    expect(readAdminEnv({ ADMIN_USER: 'x', ADMIN_PASSWORD: 'y' })).toBeNull();
  });

  it('throws when secret is too short', () => {
    expect(() =>
      readAdminEnv({ ADMIN_USER: 'a', ADMIN_PASSWORD: 'b', ADMIN_JWT_SECRET: 'short' }),
    ).toThrow(/最低 32 文字/);
  });

  it('returns env when valid', () => {
    const env = readAdminEnv({
      ADMIN_USER: 'admin',
      ADMIN_PASSWORD: 'secret',
      ADMIN_JWT_SECRET: VALID_SECRET,
    });
    expect(env?.user).toBe('admin');
    expect(env?.password).toBe('secret');
    expect(env?.secret.length).toBe(64);
  });
});

describe('verifyLoginCredentials', () => {
  it('accepts matching credentials', async () => {
    const env = readAdminEnv({
      ADMIN_USER: 'admin',
      ADMIN_PASSWORD: 'secret',
      ADMIN_JWT_SECRET: VALID_SECRET,
    })!;
    expect(await verifyLoginCredentials(env, { user: 'admin', password: 'secret' })).toBe(true);
  });

  it('rejects mismatched user', async () => {
    const env = readAdminEnv({
      ADMIN_USER: 'admin',
      ADMIN_PASSWORD: 'secret',
      ADMIN_JWT_SECRET: VALID_SECRET,
    })!;
    expect(await verifyLoginCredentials(env, { user: 'other', password: 'secret' })).toBe(false);
  });

  it('rejects mismatched password', async () => {
    const env = readAdminEnv({
      ADMIN_USER: 'admin',
      ADMIN_PASSWORD: 'secret',
      ADMIN_JWT_SECRET: VALID_SECRET,
    })!;
    expect(await verifyLoginCredentials(env, { user: 'admin', password: 'wrong' })).toBe(false);
  });
});

describe('JWT round-trip', () => {
  it('issued token verifies back', async () => {
    const env = readAdminEnv({
      ADMIN_USER: 'admin',
      ADMIN_PASSWORD: 'secret',
      ADMIN_JWT_SECRET: VALID_SECRET,
    })!;
    const token = await issueSessionToken(env, 60);
    const session = await verifySessionToken(env, token);
    expect(session?.sub).toBe('admin');
  });

  it('null/empty token returns null', async () => {
    const env = readAdminEnv({
      ADMIN_USER: 'admin',
      ADMIN_PASSWORD: 'secret',
      ADMIN_JWT_SECRET: VALID_SECRET,
    })!;
    expect(await verifySessionToken(env, null)).toBeNull();
    expect(await verifySessionToken(env, undefined)).toBeNull();
    expect(await verifySessionToken(env, '')).toBeNull();
  });

  it('rejects token signed with different secret', async () => {
    const env1 = readAdminEnv({
      ADMIN_USER: 'admin',
      ADMIN_PASSWORD: 'secret',
      ADMIN_JWT_SECRET: VALID_SECRET,
    })!;
    const env2 = readAdminEnv({
      ADMIN_USER: 'admin',
      ADMIN_PASSWORD: 'secret',
      ADMIN_JWT_SECRET: 'b'.repeat(64),
    })!;
    const token = await issueSessionToken(env1, 60);
    expect(await verifySessionToken(env2, token)).toBeNull();
  });

  it('rejects token where sub does not match expected user', async () => {
    const envA = readAdminEnv({
      ADMIN_USER: 'admin',
      ADMIN_PASSWORD: 'secret',
      ADMIN_JWT_SECRET: VALID_SECRET,
    })!;
    const token = await issueSessionToken(envA, 60);

    const envB = readAdminEnv({
      ADMIN_USER: 'someone-else',
      ADMIN_PASSWORD: 'secret',
      ADMIN_JWT_SECRET: VALID_SECRET,
    })!;
    expect(await verifySessionToken(envB, token)).toBeNull();
  });
});
