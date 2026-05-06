/**
 * 管理画面用の geocode エンドポイント。
 * - GET ?q=... : 国土地理院 forward geocode (住所/自治体名 → 座標候補)
 * - POST { lat, lng } : 国土地理院 reverse geocode (座標 → muniCd, prefCd, address)
 *
 * /api/lookup は registry 検索が前提のため、未登録自治体を扱う管理画面では
 * 生の geocode 結果が欲しいケースがある。それを担う薄い wrapper。
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { forwardGeocode, reverseGeocode } from '@/lib/geocode';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q');
  if (!q) return NextResponse.json({ error: 'q required' }, { status: 400 });
  try {
    const hits = await forwardGeocode(q);
    return NextResponse.json({ hits: hits.slice(0, 8) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

const PostSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }
  const parsed = PostSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'invalid body' }, { status: 400 });

  try {
    const r = await reverseGeocode(parsed.data.lat, parsed.data.lng);
    return NextResponse.json(r ?? null);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
