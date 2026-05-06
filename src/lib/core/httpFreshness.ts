/**
 * HTTP HEAD-based freshness checker for URL-addressable sources.
 *
 * Generic: pass any `{url, last_modified?, etag?, content_length?}` and this
 * implementation will issue a HEAD and compare.
 *
 * Used by Sonae for PDF freshness; reusable for any HTTP source.
 */

import type { Freshness, FreshnessVerdict, PipelineContext } from './types';

export interface HttpSourceMeta {
  url: string;
  last_modified?: string;
  etag?: string;
  content_length?: number;
}

export interface HttpServerHeaders {
  last_modified?: string;
  etag?: string;
  content_length?: number;
}

export interface HttpFreshnessResult {
  verdict: FreshnessVerdict;
  reason: string;
  serverHeaders: HttpServerHeaders;
}

export interface HttpFreshnessOptions {
  userAgent?: string;
}

const DEFAULT_UA =
  'Mozilla/5.0 (compatible; SonaePipeline/1.0; +https://github.com/couzip/bousai-copilot)';

export function createHttpFreshness<TSource extends { url: string }>(
  opts: HttpFreshnessOptions = {},
): Freshness<TSource, HttpSourceMeta> & {
  /** Lower-level helper for callers that want the full result, not just the verdict. */
  inspect(
    source: TSource,
    cachedMeta: HttpSourceMeta,
    ctx: PipelineContext,
  ): Promise<HttpFreshnessResult>;
} {
  const userAgent = opts.userAgent ?? DEFAULT_UA;

  async function inspect(
    source: TSource,
    cachedMeta: HttpSourceMeta,
    ctx: PipelineContext,
  ): Promise<HttpFreshnessResult> {
    let serverHeaders: HttpServerHeaders = {};
    try {
      const r = await fetch(source.url, {
        method: 'HEAD',
        headers: { 'User-Agent': userAgent },
        redirect: 'follow',
        signal: ctx.signal,
      });
      if (!r.ok) {
        return {
          verdict: 'unknown',
          reason: `HEAD HTTP ${r.status}`,
          serverHeaders,
        };
      }
      serverHeaders = {
        last_modified: r.headers.get('last-modified') ?? undefined,
        etag: r.headers.get('etag') ?? undefined,
        content_length: parseLen(r.headers.get('content-length')),
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return {
        verdict: 'unknown',
        reason: `HEAD failed: ${msg}`,
        serverHeaders,
      };
    }

    if (serverHeaders.etag && cachedMeta.etag) {
      if (serverHeaders.etag === cachedMeta.etag) {
        return {
          verdict: 'fresh',
          reason: `ETag一致 (${serverHeaders.etag})`,
          serverHeaders,
        };
      }
      return {
        verdict: 'stale',
        reason: `ETag不一致 (cached=${cachedMeta.etag} server=${serverHeaders.etag})`,
        serverHeaders,
      };
    }
    if (serverHeaders.last_modified && cachedMeta.last_modified) {
      if (serverHeaders.last_modified === cachedMeta.last_modified) {
        return {
          verdict: 'fresh',
          reason: `Last-Modified一致 (${serverHeaders.last_modified})`,
          serverHeaders,
        };
      }
      return {
        verdict: 'stale',
        reason: `Last-Modified不一致`,
        serverHeaders,
      };
    }
    if (serverHeaders.content_length !== undefined && cachedMeta.content_length !== undefined) {
      if (serverHeaders.content_length === cachedMeta.content_length) {
        return {
          verdict: 'fresh',
          reason: `Content-Length一致 (${serverHeaders.content_length}bytes)`,
          serverHeaders,
        };
      }
      return {
        verdict: 'stale',
        reason: `Content-Length不一致`,
        serverHeaders,
      };
    }
    return {
      verdict: 'unknown',
      reason: 'ETag/Last-Modified/Content-Length のいずれも比較不能',
      serverHeaders,
    };
  }

  return {
    async check(source, cachedMeta, ctx) {
      const r = await inspect(source, cachedMeta, ctx);
      return r.verdict;
    },
    inspect,
  };
}

function parseLen(s: string | null): number | undefined {
  if (!s) return undefined;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : undefined;
}
