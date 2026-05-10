import { NextResponse } from 'next/server';
import { z } from 'zod';
import { forwardGeocode } from '@/lib/geocode';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const QuerySchema = z.object({ q: z.string().min(1).max(200) });

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({ q: url.searchParams.get('q') ?? '' });
  if (!parsed.success) {
    return NextResponse.json({ error: 'クエリパラメータ q が必要です' }, { status: 400 });
  }

  const hits = await forwardGeocode(parsed.data.q.trim());
  if (hits.length === 0) {
    return NextResponse.json(
      { error: '住所検索が応答しません。少し待って再入力してください。' },
      { status: 504 },
    );
  }
  return NextResponse.json({ suggestions: hits.slice(0, 5) });
}
