import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { purgeCache } from './cachePurge';

let tmp: string;
const savedEnv = process.env.SONAE_CACHE_DIR;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'sonae-purge-'));
  process.env.SONAE_CACHE_DIR = tmp;
});

afterEach(() => {
  if (savedEnv === undefined) delete process.env.SONAE_CACHE_DIR;
  else process.env.SONAE_CACHE_DIR = savedEnv;
  rmSync(tmp, { recursive: true, force: true });
});

function seed(rel: string, body = ''): string {
  const full = join(tmp, rel);
  mkdirSync(join(full, '..'), { recursive: true });
  writeFileSync(full, body);
  return full;
}

describe('purgeCache', () => {
  it('layer=discovery: discovery/<code>.json のみ削除', () => {
    const target = seed('discovery/14100.json');
    const other = seed('pdfs/14100.pdf');
    purgeCache('14100', 'discovery');
    expect(existsSync(target)).toBe(false);
    expect(existsSync(other)).toBe(true);
  });

  it('layer=pdf: pdf 本体 + meta + http を全部削除', () => {
    const a = seed('pdfs/14100.pdf');
    const b = seed('pdfs/14100.meta.json');
    const c = seed('pdfs/14100.http.json');
    const other = seed('pdfs/14206.pdf');
    purgeCache('14100', 'pdf');
    expect(existsSync(a)).toBe(false);
    expect(existsSync(b)).toBe(false);
    expect(existsSync(c)).toBe(false);
    expect(existsSync(other)).toBe(true);
  });

  it('layer=ocr: ocr/<code>.md と meta.json を削除', () => {
    const a = seed('ocr/14100.md');
    const b = seed('ocr/14100.meta.json');
    purgeCache('14100', 'ocr');
    expect(existsSync(a)).toBe(false);
    expect(existsSync(b)).toBe(false);
  });

  it('layer=result: municipalities/<code>.json を削除', () => {
    const a = seed('municipalities/14100.json');
    purgeCache('14100', 'result');
    expect(existsSync(a)).toBe(false);
  });

  it('layer=work: work/<code>_* で始まる全ディレクトリ/ファイルを削除', () => {
    const dirA = join(tmp, 'work', '14100_abc_123');
    mkdirSync(dirA, { recursive: true });
    writeFileSync(join(dirA, 'toc.md'), '');
    const dirOther = join(tmp, 'work', '14206_xyz_456');
    mkdirSync(dirOther, { recursive: true });
    writeFileSync(join(dirOther, 'toc.md'), '');
    purgeCache('14100', 'work');
    expect(existsSync(dirA)).toBe(false);
    expect(existsSync(dirOther)).toBe(true);
  });

  it('layer=all: 全 layer を削除', () => {
    seed('discovery/14100.json');
    seed('pdfs/14100.pdf');
    seed('ocr/14100.md');
    seed('municipalities/14100.json');
    purgeCache('14100', 'all');
    expect(existsSync(join(tmp, 'discovery/14100.json'))).toBe(false);
    expect(existsSync(join(tmp, 'pdfs/14100.pdf'))).toBe(false);
    expect(existsSync(join(tmp, 'ocr/14100.md'))).toBe(false);
    expect(existsSync(join(tmp, 'municipalities/14100.json'))).toBe(false);
  });

  it('該当ファイルが無くてもエラーにしない', () => {
    expect(() => purgeCache('99999', 'all')).not.toThrow();
  });
});
