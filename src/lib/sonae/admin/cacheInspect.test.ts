import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  inspectCacheBriefly,
  listAllCachedCodes,
  readCachedMunicipalityName,
} from './cacheInspect';

let tmp: string;
const savedEnv = process.env.SONAE_CACHE_DIR;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'sonae-cache-test-'));
  process.env.SONAE_CACHE_DIR = tmp;
});

afterEach(() => {
  if (savedEnv === undefined) delete process.env.SONAE_CACHE_DIR;
  else process.env.SONAE_CACHE_DIR = savedEnv;
  rmSync(tmp, { recursive: true, force: true });
});

function seed(layer: string, filename: string, body: string): void {
  const dir = join(tmp, layer);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, filename), body);
}

describe('listAllCachedCodes', () => {
  it('discovery / pdfs / ocr / municipalities の各ディレクトリから 5 桁コードを集約する', () => {
    seed('discovery', '14100.json', '{}');
    seed('pdfs', '14100.pdf', 'pdf');
    seed('ocr', '43100.md', 'ocr');
    seed('municipalities', '36202.json', '{"city":"鳴門市"}');
    expect(listAllCachedCodes()).toEqual(['14100', '36202', '43100']);
  });

  it('5 桁ファイル名以外は無視する', () => {
    seed('discovery', '14100.json', '{}');
    seed('discovery', 'README.txt', 'note');
    seed('discovery', '999.json', 'short code');
    expect(listAllCachedCodes()).toEqual(['14100']);
  });

  it('該当ディレクトリが無い場合は空配列', () => {
    expect(listAllCachedCodes()).toEqual([]);
  });
});

describe('readCachedMunicipalityName', () => {
  it('result.json の city フィールドから名前を取れる', () => {
    seed('municipalities', '14100.json', '{"city":"横浜市","by_disaster_type":[]}');
    expect(readCachedMunicipalityName('14100')).toBe('横浜市');
  });

  it('result.json が無い場合は null', () => {
    expect(readCachedMunicipalityName('99999')).toBeNull();
  });

  it('壊れた JSON は null', () => {
    seed('municipalities', '14100.json', '{ this is not json');
    expect(readCachedMunicipalityName('14100')).toBeNull();
  });

  it('city フィールドが無い JSON は null', () => {
    seed('municipalities', '14100.json', '{"by_disaster_type":[]}');
    expect(readCachedMunicipalityName('14100')).toBeNull();
  });
});

describe('inspectCacheBriefly', () => {
  it('各 layer の存否を boolean で返す', () => {
    seed('pdfs', '14100.pdf', 'pdf');
    seed('municipalities', '14100.json', '{}');
    const r = inspectCacheBriefly('14100');
    expect(r.pdf).toBe(true);
    expect(r.result).toBe(true);
    expect(r.discovery).toBe(false);
    expect(r.ocr).toBe(false);
  });

  it('cache 完全に空ならすべて false', () => {
    const r = inspectCacheBriefly('99999');
    expect(r).toEqual({ discovery: false, pdf: false, ocr: false, result: false });
  });
});
