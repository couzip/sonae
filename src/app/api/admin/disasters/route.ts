import type { ProgressEvent } from '@/lib/core';
import { runSonaePipelineAsAdmin } from '@/lib/sonae';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 3600;

function sseFormat(event: ProgressEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const force = searchParams.get('force') === '1';
  const forceExtract = searchParams.get('force_ocr') === '1';
  const name = searchParams.get('name') ?? undefined;
  const prefecture = searchParams.get('prefecture') ?? undefined;

  if (!code) return new Response('code required', { status: 400 });

  const encoder = new TextEncoder();
  const abortController = new AbortController();
  req.signal.addEventListener('abort', () => abortController.abort());

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: ProgressEvent) => {
        try {
          controller.enqueue(encoder.encode(sseFormat(event)));
        } catch {
          /* controller closed */
        }
      };

      try {
        await runSonaePipelineAsAdmin(code, {
          emit,
          signal: abortController.signal,
          force,
          forceExtract,
          cityName: name,
          prefecture,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        emit({ type: 'error', message: `エラー: ${msg}` });
      } finally {
        try {
          controller.close();
        } catch {
          /* noop */
        }
      }
    },
    cancel() {
      abortController.abort();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
