import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BinaryFileCache, JsonFileCache, TextFileCache, type PipelineContext } from './index';

const ctx: PipelineContext = { emit: () => {} };

describe('JsonFileCache', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'sonae-test-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('returns null for missing key', async () => {
    const c = new JsonFileCache<{ a: number }>({ dir, ext: 'json' });
    expect(await c.read('nope', ctx)).toBeNull();
  });

  it('round-trips JSON values', async () => {
    const c = new JsonFileCache<{ a: number; b: string }>({ dir, ext: 'json' });
    await c.write('k', { a: 1, b: 'hi' }, ctx);
    expect(await c.read('k', ctx)).toEqual({ a: 1, b: 'hi' });
  });

  it('invalidate removes the entry', async () => {
    const c = new JsonFileCache<{ a: number }>({ dir, ext: 'json' });
    await c.write('k', { a: 1 }, ctx);
    expect(existsSync(join(dir, 'k.json'))).toBe(true);
    await c.invalidate('k', ctx);
    expect(existsSync(join(dir, 'k.json'))).toBe(false);
    expect(await c.read('k', ctx)).toBeNull();
  });

  it('respects custom filename builder', async () => {
    const c = new JsonFileCache<{ a: number }>({
      dir,
      ext: 'json',
      filename: (k) => `${k}.meta.json`,
    });
    await c.write('alpha', { a: 9 }, ctx);
    expect(existsSync(join(dir, 'alpha.meta.json'))).toBe(true);
  });

  it('atomic write — rename from .tmp', async () => {
    const c = new JsonFileCache<{ a: number }>({ dir, ext: 'json' });
    await c.write('k', { a: 42 }, ctx);
    // tmp file should be cleaned up
    expect(existsSync(join(dir, 'k.json.tmp'))).toBe(false);
    expect(existsSync(join(dir, 'k.json'))).toBe(true);
  });
});

describe('TextFileCache', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'sonae-test-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('round-trips arbitrary unicode text', async () => {
    const c = new TextFileCache({ dir, ext: 'md' });
    const body = '# 横浜市\n## 想定災害\n- 地震 (震度7)\n- 津波 (10m)\n';
    await c.write('14100', body, ctx);
    expect(await c.read('14100', ctx)).toBe(body);
  });
});

describe('BinaryFileCache', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'sonae-test-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('round-trips a binary buffer', async () => {
    const c = new BinaryFileCache({ dir, ext: 'bin' });
    const buf = Buffer.from([0xff, 0x00, 0x01, 0x02, 0xfe]);
    await c.write('k', buf, ctx);
    const out = await c.read('k', ctx);
    expect(out).not.toBeNull();
    expect(Buffer.compare(out!, buf)).toBe(0);
  });
});
