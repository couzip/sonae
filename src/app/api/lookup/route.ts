import { NextResponse } from 'next/server';
import { z } from 'zod';
import { resolveMunicipality, type ResolveInput } from '@/lib/sonae';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Coords = z.object({ lat: z.number(), lng: z.number() });

const RequestSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('gps'), value: Coords }),
  z.object({ mode: z.literal('click'), value: Coords }),
  z.object({
    mode: z.literal('address'),
    value: z.string().min(1),
    hint: Coords.optional(),
  }),
]);

function toResolveInput(parsed: z.infer<typeof RequestSchema>): ResolveInput {
  if (parsed.mode === 'address') {
    return { query: parsed.value, coords: parsed.hint };
  }
  return { coords: parsed.value };
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '不正な JSON です' }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'リクエスト内容が不正です', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const result = await resolveMunicipality(toResolveInput(parsed.data));
  if (!result) {
    return NextResponse.json(
      { error: '住所/座標から自治体を特定できませんでした。地図クリックで指定してみてください。' },
      { status: 404 },
    );
  }
  return NextResponse.json(result);
}
