/**
 * 政令指定都市の区コード → 親市コード への変換。
 *
 * 地域防災計画は政令市単位 (親市) で発行されるため、区コードを親市コードに
 * 正規化する必要がある。データソースは `data/seirei_wards.json` で、
 * 総務省 JIS X 0402 の政令市区コードを集約したもの。東京 23 区
 * (13101-13123) は単独自治体扱いなのでマップに含まれない。
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

let _map: Record<string, string> | null = null;

function loadMap(): Record<string, string> {
  if (_map) return _map;
  const path = join(process.cwd(), 'data', 'seirei_wards.json');
  const raw = readFileSync(path, 'utf-8');
  const parsed = JSON.parse(raw) as Record<string, string>;
  // _comment エントリは除外
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(parsed)) {
    if (k.startsWith('_')) continue;
    out[k] = v;
  }
  _map = out;
  return _map;
}

/**
 * 与えられた自治体コードが政令市の区コードであれば、親市コードを返す。
 * 区でない場合 (独立市・町村・東京 23 区) は null。
 */
export function parentCityCodeOfWard(code: string | undefined | null): string | null {
  if (!code) return null;
  const map = loadMap();
  return map[code] ?? null;
}
