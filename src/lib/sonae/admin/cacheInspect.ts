/**
 * cache/ 配下の状況を読み取る。各 layer (discovery / pdf / ocr / result / work) について
 * ファイルの存在 / size / mtime を返す。
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
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

function inspectLayer(layer: CacheLayerStatus['layer'], code: string): CacheLayerStatus {
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

/**
 * cache/ 配下を走査して、登場するすべての自治体コードを返す。
 * discovery / pdfs / ocr / municipalities (= result) の各ディレクトリのファイル名から
 * 5 桁の数値プレフィックスを抽出して和集合を取る。
 */
export function listAllCachedCodes(): string[] {
  const root = cacheRoot();
  const dirs = ['discovery', 'pdfs', 'ocr', 'municipalities'];
  const codes = new Set<string>();
  for (const d of dirs) {
    let names: string[] = [];
    try {
      names = readdirSync(join(root, d));
    } catch {
      continue;
    }
    for (const name of names) {
      const m = name.match(/^(\d{5})\b/);
      if (m) codes.add(m[1]!);
    }
  }
  return Array.from(codes).sort();
}

/**
 * cache/municipalities/{code}.json から自治体名 (city フィールド) を読み出す。
 * 解析結果が無い (result 未生成) 場合は null。
 */
export function readCachedMunicipalityName(code: string): string | null {
  const root = cacheRoot();
  const p = join(root, 'municipalities', `${code}.json`);
  try {
    const raw = readFileSync(p, 'utf-8');
    const j = JSON.parse(raw);
    if (j && typeof j.city === 'string' && j.city.length > 0) return j.city as string;
  } catch {
    /* ignore */
  }
  return null;
}
