/**
 * cache/ 配下の状況を読み取る。各 layer (discovery / pdf / ocr / result / work) について
 * ファイルの存在 / size / mtime を返す。
 */

import { readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

function cacheRoot(): string {
  return process.env.SONAE_CACHE_DIR
    ? resolve(process.env.SONAE_CACHE_DIR)
    : join(process.cwd(), 'cache');
}

export interface CacheFileInfo {
  path: string;
  exists: boolean;
  size_bytes?: number;
  mtime?: string;
}

export interface CacheLayerStatus {
  layer: 'discovery' | 'pdf' | 'ocr' | 'result' | 'work';
  files: CacheFileInfo[];
  exists: boolean;
}

export interface CacheStatus {
  code: string;
  layers: CacheLayerStatus[];
}

function statSafe(p: string): CacheFileInfo {
  try {
    const s = statSync(p);
    return {
      path: p,
      exists: true,
      size_bytes: s.size,
      mtime: s.mtime.toISOString(),
    };
  } catch {
    return { path: p, exists: false };
  }
}

function inspectLayer(
  layer: CacheLayerStatus['layer'],
  code: string,
): CacheLayerStatus {
  const root = cacheRoot();
  const dir = join(root, layer === 'pdf' ? 'pdfs' : layer === 'result' ? 'municipalities' : layer);

  const files: CacheFileInfo[] = [];
  if (layer === 'discovery') {
    files.push(statSafe(join(dir, `${code}.json`)));
  } else if (layer === 'pdf') {
    files.push(statSafe(join(dir, `${code}.pdf`)));
    files.push(statSafe(join(dir, `${code}.meta.json`)));
    files.push(statSafe(join(dir, `${code}.http.json`)));
  } else if (layer === 'ocr') {
    files.push(statSafe(join(dir, `${code}.md`)));
    files.push(statSafe(join(dir, `${code}.meta.json`)));
  } else if (layer === 'result') {
    files.push(statSafe(join(dir, `${code}.json`)));
  } else if (layer === 'work') {
    try {
      for (const name of readdirSync(dir)) {
        if (!name.startsWith(`${code}_`)) continue;
        files.push(statSafe(join(dir, name)));
      }
    } catch {
      // dir 不在
    }
  }

  return {
    layer,
    files,
    exists: files.some((f) => f.exists),
  };
}

export function inspectCache(code: string): CacheStatus {
  return {
    code,
    layers: (['discovery', 'pdf', 'ocr', 'result', 'work'] as const).map((l) =>
      inspectLayer(l, code),
    ),
  };
}

export function inspectCacheBriefly(code: string): {
  discovery: boolean;
  pdf: boolean;
  ocr: boolean;
  result: boolean;
} {
  const status = inspectCache(code);
  return {
    discovery: status.layers.find((l) => l.layer === 'discovery')?.exists ?? false,
    pdf: status.layers.find((l) => l.layer === 'pdf')?.exists ?? false,
    ocr: status.layers.find((l) => l.layer === 'ocr')?.exists ?? false,
    result: status.layers.find((l) => l.layer === 'result')?.exists ?? false,
  };
}
