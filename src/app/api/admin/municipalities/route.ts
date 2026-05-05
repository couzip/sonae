import { NextResponse } from 'next/server';
import {
  addRegistryEntry,
  listRegistryEntries,
} from '@/lib/sonae/admin/registry';
import { inspectCacheBriefly } from '@/lib/sonae/admin/cacheInspect';
import { MunicipalitySchema } from '@/lib/sonae/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const items = listRegistryEntries().map((m) => ({
    ...m,
    cache: inspectCacheBriefly(m.code),
  }));
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }
  const parsed = MunicipalitySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid body', issues: parsed.error.issues },
      { status: 400 },
    );
  }
  try {
    addRegistryEntry(parsed.data);
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 409 });
  }
  return NextResponse.json({ ok: true, code: parsed.data.code }, { status: 201 });
}
