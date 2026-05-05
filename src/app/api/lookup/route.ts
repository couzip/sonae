import { NextResponse } from 'next/server';
import { z } from 'zod';
import { findByCode, findByName, findNearestByCoords } from '@/lib/sonae';
import { forwardGeocode, heartRailsReverse, reverseGeocode } from '@/lib/geocode';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RequestSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('gps'), value: z.object({ lat: z.number(), lng: z.number() }) }),
  z.object({ mode: z.literal('address'), value: z.string().min(1) }),
  z.object({ mode: z.literal('click'), value: z.object({ lat: z.number(), lng: z.number() }) }),
]);

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid body', issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const input = parsed.data;

  // 1. 座標 → 解決順序:
  //    (a) GSI reverse → muniCd を curated registry に照合
  //    (b) HeartRails reverse → city/prefecture を直接取得 (全国対応)
  //    (c) どちらも空なら 404
  if (input.mode === 'gps' || input.mode === 'click') {
    const { lat, lng } = input.value;
    let address = '';
    let muniCd = '';
    try {
      const rev = await reverseGeocode(lat, lng);
      if (rev) {
        address = rev.address;
        muniCd = rev.city_code;
      }
    } catch {
      /* ignore */
    }

    // (a) curated registry hit (alias / disaster_plan_url pin がある場合)
    let muni = muniCd ? findByCode(muniCd) : null;
    // 政令指定都市の区 (例: 熊本市南区 43103) は registry には親市 (43100) しか
    // 入っていない。区単位での地域防災計画は東京 23 区のみで発行されており、
    // 他の政令市では市単位で発行されるため、未登録の区コードは親市にフォールバック。
    if (!muni && muniCd && muniCd.length === 5 && !muniCd.endsWith('00')) {
      const parentCode = `${muniCd.slice(0, 2)}100`;
      muni = findByCode(parentCode);
    }
    if (!muni && address) muni = findByName(address);
    if (muni) {
      return NextResponse.json({
        municipality_code: muni.code,
        name: muni.name,
        prefecture: muni.prefecture,
        source: 'registry',
        resolved: { lat, lng, address: address || `${muni.prefecture}${muni.name}` },
      });
    }

    // (b) HeartRails で直接 city / prefecture を取得 → 全国対応
    try {
      const hr = await heartRailsReverse(lat, lng);
      if (hr) {
        return NextResponse.json({
          municipality_code: muniCd || `hr_${hr.prefecture}_${hr.city}`,
          name: hr.city,
          prefecture: hr.prefecture,
          source: 'heartrails',
          resolved: {
            lat,
            lng,
            address: address || `${hr.prefecture}${hr.city}${hr.town}`,
          },
        });
      }
    } catch {
      /* ignore */
    }

    // (c) いずれも解決できず
    return NextResponse.json(
      {
        error: '場所を特定できませんでした',
        resolved: { lat, lng, address },
      },
      { status: 404 },
    );
  }

  // 2. address → forward geocode → 自治体名で registry 検索
  if (input.mode === 'address') {
    const query = input.value;
    let resolvedLat = 0;
    let resolvedLng = 0;
    let resolvedAddress = query;
    let muni = findByName(query);
    if (!muni) {
      try {
        const hits = await forwardGeocode(query);
        if (hits.length) {
          const top = hits[0];
          resolvedLat = top.lat;
          resolvedLng = top.lng;
          resolvedAddress = top.address;
          muni = findByName(top.address);
          if (!muni) muni = findNearestByCoords(top.lat, top.lng);
        }
      } catch {
        // ignore
      }
    }
    if (!muni) {
      return NextResponse.json({ error: 'no municipality match', query }, { status: 404 });
    }
    return NextResponse.json({
      municipality_code: muni.code,
      name: muni.name,
      prefecture: muni.prefecture,
      source: 'registry',
      resolved: {
        lat: resolvedLat || muni.lat || 0,
        lng: resolvedLng || muni.lng || 0,
        address: resolvedAddress,
      },
    });
  }

  return NextResponse.json({ error: 'unknown mode' }, { status: 400 });
}
