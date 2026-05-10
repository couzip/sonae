/**
 * 単一の座標解決パイプライン。gps / click / address どのモードも入り口で
 * `ResolveInput` に正規化し、この関数を経由する。
 *
 * 経路は 5 段の素直なフォールバック:
 *   1. query → registry findByName (高速 short-circuit)
 *   2. query → GSI forward → 座標
 *   3. 標準化住所 → registry findByName
 *   4. 座標 → GSI reverse → muniCd → registry / 政令市の区フォールバック
 *   5. 座標 → HeartRails reverse → 全国対応 (registry 外の自治体もここで拾う)
 */

import { forwardGeocode, heartRailsReverse, reverseGeocode } from '@/lib/geocode';
import { findByCode, findByName } from './municipality';
import type { Municipality } from './schemas';
import { parentCityCodeOfWard } from './seirei';

export interface ResolveInput {
  coords?: { lat: number; lng: number };
  query?: string;
}

export interface ResolveResult {
  municipality_code: string;
  name: string;
  prefecture: string;
  source: 'registry' | 'heartrails';
  resolved: { lat: number; lng: number; address: string };
}

function ok(
  muni: Municipality,
  lat: number,
  lng: number,
  address: string,
): ResolveResult {
  return {
    municipality_code: muni.code,
    name: muni.name,
    prefecture: muni.prefecture,
    source: 'registry',
    resolved: {
      lat: lat || muni.lat || 0,
      lng: lng || muni.lng || 0,
      address: address || `${muni.prefecture}${muni.name}`,
    },
  };
}

export async function resolveMunicipality(
  input: ResolveInput,
): Promise<ResolveResult | null> {
  let lat = input.coords?.lat;
  let lng = input.coords?.lng;
  let address = '';
  const query = input.query?.trim() ?? '';

  // 1. query で registry 直接マッチ → 即返却
  if (query) {
    const direct = findByName(query);
    if (direct) {
      return ok(direct, lat ?? direct.lat ?? 0, lng ?? direct.lng ?? 0, query);
    }
  }

  // 2. 座標が無ければ query を GSI forward で座標化
  if ((lat == null || lng == null) && query) {
    try {
      const hits = await forwardGeocode(query);
      if (hits.length > 0) {
        lat = hits[0].lat;
        lng = hits[0].lng;
        address = hits[0].address;
      }
    } catch {
      /* GSI 落ち / timeout → 次段へ */
    }
  }

  if (lat == null || lng == null) return null;

  // 3. 標準化住所で registry findByName
  if (address) {
    const fromAddr = findByName(address);
    if (fromAddr) return ok(fromAddr, lat, lng, address);
  }

  // 4. 座標 → GSI reverse → muniCd → registry / 政令市の区フォールバック
  try {
    const rev = await reverseGeocode(lat, lng);
    if (rev) {
      if (!address) address = rev.address;
      if (rev.city_code) {
        let muni = findByCode(rev.city_code);
        if (!muni) {
          const parentCode = parentCityCodeOfWard(rev.city_code);
          if (parentCode) muni = findByCode(parentCode);
        }
        if (!muni && rev.address) muni = findByName(rev.address);
        if (muni) {
          return ok(muni, lat, lng, address || `${muni.prefecture}${muni.name}`);
        }
      }
    }
  } catch {
    /* ignore */
  }

  // 5. HeartRails reverse → 全国対応 (registry 外の自治体)
  try {
    const hr = await heartRailsReverse(lat, lng);
    if (hr) {
      return {
        municipality_code: `hr_${hr.prefecture}_${hr.city}`,
        name: hr.city,
        prefecture: hr.prefecture,
        source: 'heartrails',
        resolved: {
          lat,
          lng,
          address: address || `${hr.prefecture}${hr.city}${hr.town}`,
        },
      };
    }
  } catch {
    /* ignore */
  }

  return null;
}
