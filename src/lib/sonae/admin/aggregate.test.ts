import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let tmp: string;
const savedCacheEnv = process.env.SONAE_CACHE_DIR;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'sonae-agg-'));
  process.env.SONAE_CACHE_DIR = tmp;
  vi.resetModules();
});

afterEach(() => {
  if (savedCacheEnv === undefined) delete process.env.SONAE_CACHE_DIR;
  else process.env.SONAE_CACHE_DIR = savedCacheEnv;
  rmSync(tmp, { recursive: true, force: true });
});

function seedResult(code: string, city: string): void {
  const dir = join(tmp, 'municipalities');
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, `${code}.json`),
    JSON.stringify({ city, by_disaster_type: [] }),
  );
}

describe('listAdminMunicipalities', () => {
  it('registry のみの自治体は in_registry=true で返る', async () => {
    const { listAdminMunicipalities } = await import('./aggregate');
    const all = listAdminMunicipalities();
    const yokohama = all.find((m) => m.code === '14100');
    expect(yokohama?.name).toBe('横浜市');
    expect(yokohama?.in_registry).toBe(true);
  });

  it('cache のみの自治体は in_registry=false、name は cache の city フィールドから', async () => {
    seedResult('43204', '荒尾市');
    const { listAdminMunicipalities } = await import('./aggregate');
    const all = listAdminMunicipalities();
    const arao = all.find((m) => m.code === '43204');
    expect(arao?.name).toBe('荒尾市');
    expect(arao?.in_registry).toBe(false);
    expect(arao?.prefecture).toBe('熊本県');
  });

  it('cache のみで result が無いコードは "(自治体 XXXXX)" 形式で返る', async () => {
    const dir = join(tmp, 'discovery');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, '43204.json'), '{}');
    const { listAdminMunicipalities } = await import('./aggregate');
    const all = listAdminMunicipalities();
    const arao = all.find((m) => m.code === '43204');
    expect(arao?.name).toBe('(自治体 43204)');
    expect(arao?.in_registry).toBe(false);
  });
});

describe('groupAdminMunicipalitiesByPrefecture', () => {
  it('都道府県ごとに自治体をまとめ、registered/cached 件数を計算する', async () => {
    seedResult('14206', '小田原市');
    const { groupAdminMunicipalitiesByPrefecture } = await import('./aggregate');
    const buckets = groupAdminMunicipalitiesByPrefecture();
    const kanagawa = buckets.find((b) => b.prefecture_code === '14');
    expect(kanagawa?.prefecture).toBe('神奈川県');
    expect(kanagawa?.municipalities.some((m) => m.code === '14206')).toBe(true);
    expect(kanagawa?.municipalities.some((m) => m.code === '14100')).toBe(true);
    expect(kanagawa?.cached).toBeGreaterThanOrEqual(1);
  });
});

describe('findAdminMunicipality', () => {
  it('指定 code の自治体エントリを返す', async () => {
    const { findAdminMunicipality } = await import('./aggregate');
    expect(findAdminMunicipality('14100')?.name).toBe('横浜市');
    expect(findAdminMunicipality('99999')).toBeNull();
  });
});
