/**
 * admin 画面用に「registry に登録されている自治体」と「cache に存在する自治体」の
 * 和集合を取り、都道府県ごとにまとめる。UI には code を出さず、自治体名と都道府県名のみ表示する想定。
 */

import { listRegistryEntries } from './registry';
import {
  inspectCacheBriefly,
  listAllCachedCodes,
  readCachedMunicipalityName,
} from './cacheInspect';
import { prefectureCodeOf, prefectureNameOf } from './prefectures';

export interface AdminMunicipality {
  code: string;
  name: string;
  prefecture: string;
  prefecture_code: string;
  in_registry: boolean;
  cache: { discovery: boolean; pdf: boolean; ocr: boolean; result: boolean };
}

export interface AdminPrefectureBucket {
  prefecture: string;
  prefecture_code: string;
  municipalities: AdminMunicipality[];
  registered: number;
  cached: number;
}

function muniNameForCachedCode(code: string): string {
  const fromResult = readCachedMunicipalityName(code);
  if (fromResult) return fromResult;
  return `(自治体 ${code})`;
}

export function listAdminMunicipalities(): AdminMunicipality[] {
  const registry = listRegistryEntries();
  const registryByCode = new Map(registry.map((m) => [m.code, m]));
  const cachedCodes = listAllCachedCodes();
  const codes = new Set<string>([...registryByCode.keys(), ...cachedCodes]);

  const items: AdminMunicipality[] = [];
  for (const code of codes) {
    const reg = registryByCode.get(code);
    const cache = inspectCacheBriefly(code);
    const prefCode = reg?.prefecture_code ?? prefectureCodeOf(code);
    const prefName = reg?.prefecture ?? prefectureNameOf(code);
    items.push({
      code,
      name: reg?.name ?? muniNameForCachedCode(code),
      prefecture: prefName,
      prefecture_code: prefCode,
      in_registry: !!reg,
      cache,
    });
  }
  items.sort((a, b) => {
    if (a.prefecture_code !== b.prefecture_code) {
      return a.prefecture_code.localeCompare(b.prefecture_code);
    }
    return a.name.localeCompare(b.name, 'ja');
  });
  return items;
}

export function groupAdminMunicipalitiesByPrefecture(): AdminPrefectureBucket[] {
  const items = listAdminMunicipalities();
  const buckets = new Map<string, AdminPrefectureBucket>();
  for (const m of items) {
    const key = m.prefecture_code;
    let b = buckets.get(key);
    if (!b) {
      b = {
        prefecture: m.prefecture,
        prefecture_code: key,
        municipalities: [],
        registered: 0,
        cached: 0,
      };
      buckets.set(key, b);
    }
    b.municipalities.push(m);
    if (m.in_registry) b.registered += 1;
    if (m.cache.result) b.cached += 1;
  }
  return Array.from(buckets.values()).sort((a, b) =>
    a.prefecture_code.localeCompare(b.prefecture_code),
  );
}

export function findAdminMunicipality(code: string): AdminMunicipality | null {
  return listAdminMunicipalities().find((m) => m.code === code) ?? null;
}
