import { NextResponse } from 'next/server';
import {
  deleteRegistryEntry,
  listRegistryEntries,
  updateRegistryEntry,
} from '@/lib/sonae/admin/registry';
import { inspectCache } from '@/lib/sonae/admin/cacheInspect';
import { MunicipalitySchema } from '@/lib/sonae/schemas';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PatchSchema = MunicipalitySchema.partial().omit({ code: true });

export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const muni = listRegistryEntries().find((m) => m.code === code);
  if (!muni) {
    return NextResponse.json({ error: `code=${code} not found` }, { status: 404 });
  }
  return NextResponse.json({ municipality: muni, cache: inspectCache(code) });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid body', issues: parsed.error.issues },
      { status: 400 },
    );
  }
  try {
    updateRegistryEntry(code, parsed.data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  try {
    deleteRegistryEntry(code);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 404 });
  }
  return new NextResponse(null, { status: 204 });
}

export type PatchBody = z.infer<typeof PatchSchema>;
