import { NextResponse } from 'next/server';
import { z } from 'zod';
import { findByName, findNearestByCoords } from '@/lib/sonae';
import { forwardGeocode, reverseGeocode } from '@/lib/geocode';

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

  // 1. 座標 → reverse geocode → name で registry 検索 → fallback nearest
  if (input.mode === 'gps' || input.mode === 'click') {
    const { lat, lng } = input.value;
    let address = '';
    let muni = null;
    try {
      const rev = await reverseGeocode(lat, lng);
      if (rev) {
        address = rev.address;
        // GSI の muniCd は別系統。registry の name で寄せる。
        // address に都道府県+市区が含まれることが多いので部分一致で当てる。
        muni = findByName(address);
      }
    } catch {
      // ignore
    }
    if (!muni) muni = findNearestByCoords(lat, lng);
    if (!muni) {
      return NextResponse.json(
        {
          error: 'no municipality match',
          resolved: { lat, lng, address },
        },
        { status: 404 },
      );
    }
    return NextResponse.json({
      municipality_code: muni.code,
      name: muni.name,
      prefecture: muni.prefecture,
      source: 'registry',
      resolved: { lat, lng, address: address || `${muni.prefecture}${muni.name}` },
    });
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
