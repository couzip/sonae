/**
 * yaml round-trip 書き込みテスト。tmp ディレクトリに municipalities.yaml を
 * 用意し、addRegistryEntry / updateRegistryEntry / deleteRegistryEntry を呼び、
 * yaml の構造とコメントが保持されているかを検査する。
 *
 * registry.ts は固定パス `data/municipalities.yaml` を読み書きするので、
 * `process.cwd()` を tmp に切り替えてサンドボックス化する。
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { addRegistryEntry, deleteRegistryEntry, updateRegistryEntry } from './registry';

const SEED_YAML = `# 神奈川県
- code: '14100'
  name: 横浜市
  prefecture: 神奈川県
  prefecture_code: '14'
  lat: 35.4437
  lng: 139.6380
  name_aliases: [横浜市, よこはま市]

- code: '14130'
  name: 川崎市
  prefecture: 神奈川県
  prefecture_code: '14'
  lat: 35.5308
  lng: 139.7029
  name_aliases: [川崎市]

# 東京都
- code: '13101'
  name: 千代田区
  prefecture: 東京都
  prefecture_code: '13'
  lat: 35.6940
  lng: 139.7536
  name_aliases: [千代田区]
`;

let tmpDir: string;
let originalCwd: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'sonae-registry-'));
  mkdirSync(join(tmpDir, 'data'), { recursive: true });
  writeFileSync(join(tmpDir, 'data', 'municipalities.yaml'), SEED_YAML, 'utf-8');
  originalCwd = process.cwd();
  process.chdir(tmpDir);
});

afterEach(() => {
  process.chdir(originalCwd);
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('addRegistryEntry', () => {
  it('既存 prefecture の最後に追加し、コメントを保持する', async () => {
    addRegistryEntry({
      code: '14150',
      name: '相模原市',
      prefecture: '神奈川県',
      prefecture_code: '14',
      lat: 35.5713,
      lng: 139.3733,
      name_aliases: ['相模原市'],
    });
    const out = readFileSync(join(tmpDir, 'data', 'municipalities.yaml'), 'utf-8');
    expect(out).toContain('# 神奈川県');
    expect(out).toContain('# 東京都');
    // 神奈川県セクション内に 相模原市 が居る (東京都より上)
    const sagaIdx = out.indexOf('相模原市');
    const tokyoIdx = out.indexOf('# 東京都');
    expect(sagaIdx).toBeGreaterThan(0);
    expect(sagaIdx).toBeLessThan(tokyoIdx);
  });

  it('未登録 prefecture の場合、ファイル末尾にコメント付きで追加する', async () => {
    addRegistryEntry({
      code: '43100',
      name: '熊本市',
      prefecture: '熊本県',
      prefecture_code: '43',
      lat: 32.8033,
      lng: 130.7079,
      name_aliases: ['熊本市'],
    });
    const out = readFileSync(join(tmpDir, 'data', 'municipalities.yaml'), 'utf-8');
    expect(out).toContain('# 熊本県');
    expect(out.indexOf('# 熊本県')).toBeGreaterThan(out.indexOf('# 東京都'));
  });

  it('重複 code は throw する', async () => {
    expect(() =>
      addRegistryEntry({
        code: '14100',
        name: '別物',
        prefecture: '神奈川県',
        prefecture_code: '14',
        lat: 0,
        lng: 0,
        name_aliases: [],
      }),
    ).toThrow(/既に登録済/);
  });
});

describe('updateRegistryEntry', () => {
  it('name_aliases を patch できる', async () => {
    updateRegistryEntry('14100', { name_aliases: ['横浜市', 'Yokohama City'] });
    const out = readFileSync(join(tmpDir, 'data', 'municipalities.yaml'), 'utf-8');
    expect(out).toContain('Yokohama City');
  });

  it('未登録 code は throw する', async () => {
    expect(() => updateRegistryEntry('99999', { name: 'x' })).toThrow(/not found/);
  });
});

describe('deleteRegistryEntry', () => {
  it('該当 code を削除する', async () => {
    deleteRegistryEntry('14130');
    const out = readFileSync(join(tmpDir, 'data', 'municipalities.yaml'), 'utf-8');
    expect(out).not.toContain('川崎市');
    expect(out).toContain('横浜市');
    expect(out).toContain('# 神奈川県');
  });
});
