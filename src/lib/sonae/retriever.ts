/**
 * Sonae Retriever.
 *
 * Downloads the disaster-plan PDF from a `SonaeSource` and writes it to the
 * cache location keyed by `municipality_code` (taken from `ctx.query`).
 * Captures HTTP HEAD-style headers (Last-Modified, ETag, Content-Length) and
 * SHA-256 for the freshness layer.
 */

import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

import type { PipelineContext, Retriever } from '@/lib/core';
import type { SonaeBlob, SonaeQuery, SonaeSource } from './types';

export interface RetrieverOptions {
  /** Build the absolute path where the PDF for this municipality code lives. */
  pdfPathFor: (municipalityCode: string) => string;
  userAgent?: string;
}

const DEFAULT_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36';

export class SonaePdfRetriever implements Retriever<SonaeSource, SonaeBlob, SonaeQuery> {
  constructor(private readonly opts: RetrieverOptions) {}

  async retrieve(
    source: SonaeSource,
    ctx: PipelineContext<SonaeQuery, SonaeSource>,
  ): Promise<SonaeBlob> {
    ctx.emit({
      type: 'phase',
      phase: 'retrieval',
      status: 'started',
      message: `PDF取得中: ${source.pdf_url}`,
    });
    const r = await fetch(source.pdf_url, {
      headers: {
        'User-Agent': this.opts.userAgent ?? DEFAULT_UA,
        Accept: 'application/pdf,*/*',
      },
      redirect: 'follow',
      signal: ctx.signal,
    });
    if (!r.ok) throw new Error(`HTTP ${r.status} fetching ${source.pdf_url}`);
    const buf = Buffer.from(await r.arrayBuffer());
    const sha256 = createHash('sha256').update(buf).digest('hex');
    const code = ctx.query?.municipality_code;
    if (!code) throw new Error('SonaePdfRetriever: ctx.query.municipality_code missing');
    const path = this.opts.pdfPathFor(code);
    writeFileSync(path, buf);

    const blob: SonaeBlob = {
      pdf_path: path,
      sha256,
      size_bytes: buf.length,
      downloaded_at: new Date().toISOString(),
      http: {
        url: source.pdf_url,
        last_modified: r.headers.get('last-modified') ?? undefined,
        etag: r.headers.get('etag') ?? undefined,
        content_length: parseLen(r.headers.get('content-length')) ?? buf.length,
      },
    };
    ctx.emit({
      type: 'phase',
      phase: 'retrieval',
      status: 'done',
      message: `保存完了 (${buf.length.toLocaleString()} bytes, sha256=${sha256.slice(0, 12)}…)`,
    });
    return blob;
  }
}

function parseLen(s: string | null): number | undefined {
  if (!s) return undefined;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : undefined;
}
