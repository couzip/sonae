/**
 * 単発スクリプト: cache/municipalities/*.json から enum 違反の disaster_type
 * エントリ (例: "高", "火山噴" 等) を削除する。
 *
 * usage: npx tsx scripts/clean-result-types.ts
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DISASTER_TYPE_ENUM } from '@/lib/sonae/schemas';

const allowed = new Set<string>(DISASTER_TYPE_ENUM);

const root = process.env.SONAE_CACHE_DIR
  ? resolve(process.env.SONAE_CACHE_DIR)
  : join(process.cwd(), 'cache');
const dir = join(root, 'municipalities');

let totalDropped = 0;
for (const f of readdirSync(dir)) {
  if (!f.endsWith('.json')) continue;
  const path = join(dir, f);
  const data = JSON.parse(readFileSync(path, 'utf-8'));
  const before = data.by_disaster_type?.length ?? 0;
  const filtered = (data.by_disaster_type ?? []).filter((t: { disaster_type: string }) =>
    allowed.has(t.disaster_type),
  );
  const dropped = before - filtered.length;
  if (dropped > 0) {
    const droppedTypes = (data.by_disaster_type ?? [])
      .filter((t: { disaster_type: string }) => !allowed.has(t.disaster_type))
      .map((t: { disaster_type: string }) => t.disaster_type);
    console.log(`${f}: drop ${dropped} entries (${droppedTypes.join(', ')})`);
    data.by_disaster_type = filtered;
    writeFileSync(path, JSON.stringify(data, null, 2), 'utf-8');
    totalDropped += dropped;
  }
}
console.log(`done. total dropped: ${totalDropped}`);
