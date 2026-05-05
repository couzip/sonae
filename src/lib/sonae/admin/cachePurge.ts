/**
 * cache/ 配下の自治体エントリを layer 単位 / 全 layer で削除する。
 */

import { readdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

export type CacheLayer = 'discovery' | 'pdf' | 'ocr' | 'result' | 'work' | 'all';

function cacheRoot(): string {
  return process.env.SONAE_CACHE_DIR
    ? resolve(process.env.SONAE_CACHE_DIR)
    : join(process.cwd(), 'cache');
}

function rmIfExists(path: string): void {
  try {
    rmSync(path, { force: true, recursive: true });
  } catch {
    // ignore
  }
}

function purgeLayer(layer: Exclude<CacheLayer, 'all'>, code: string): string[] {
  const root = cacheRoot();
  const purged: string[] = [];

  if (layer === 'discovery') {
    const p = join(root, 'discovery', `${code}.json`);
    rmIfExists(p);
    purged.push(p);
  } else if (layer === 'pdf') {
    for (const f of [`${code}.pdf`, `${code}.meta.json`, `${code}.http.json`]) {
      const p = join(root, 'pdfs', f);
      rmIfExists(p);
      purged.push(p);
    }
  } else if (layer === 'ocr') {
    for (const f of [`${code}.md`, `${code}.meta.json`]) {
      const p = join(root, 'ocr', f);
      rmIfExists(p);
      purged.push(p);
    }
  } else if (layer === 'result') {
    const p = join(root, 'municipalities', `${code}.json`);
    rmIfExists(p);
    purged.push(p);
  } else if (layer === 'work') {
    const dir = join(root, 'work');
    try {
      for (const name of readdirSync(dir)) {
        if (!name.startsWith(`${code}_`)) continue;
        const p = join(dir, name);
        rmIfExists(p);
        purged.push(p);
      }
    } catch {
      // dir 不在
    }
  }

  return purged;
}

export function purgeCache(code: string, layer: CacheLayer): string[] {
  if (layer === 'all') {
    const layers: Exclude<CacheLayer, 'all'>[] = ['discovery', 'pdf', 'ocr', 'result', 'work'];
    return layers.flatMap((l) => purgeLayer(l, code));
  }
  return purgeLayer(layer, code);
}
