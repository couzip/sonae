import { NextResponse } from 'next/server';
import { filterByDetectedDisasters, loadCountermeasures, readSonaeResult } from '@/lib/sonae';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  if (!code) return NextResponse.json({ error: 'code required' }, { status: 400 });

  try {
    const cached = await readSonaeResult(code);
    if (!cached) {
      return NextResponse.json(
        { error: 'no assessment cached for this municipality. run /api/disasters first' },
        { status: 404 },
      );
    }

    const detectedTypes = cached.by_disaster_type
      .filter((d) => d.scenarios.length > 0)
      .map((d) => d.disaster_type);

    const master = loadCountermeasures();
    const filtered = filterByDetectedDisasters(master, detectedTypes);

    return NextResponse.json({
      code,
      detected_disasters: detectedTypes,
      items: filtered,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `checklist failed: ${msg}` }, { status: 500 });
  }
}
