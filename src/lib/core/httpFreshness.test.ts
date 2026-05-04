/**
 * Tests for the HTTP HEAD-based freshness checker.
 *
 * Mocks `fetch` to control the HEAD response and verifies the verdict / reason
 * across the comparison cascade (ETag → Last-Modified → Content-Length).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHttpFreshness } from './httpFreshness';
import type { PipelineContext } from './types';

const ORIGINAL_FETCH = globalThis.fetch;

function headResponse(headers: Record<string, string>, status = 200): Response {
  return new Response(null, { status, headers });
}

const ctx: PipelineContext<unknown, { url: string }> = { emit: () => {} };

describe('createHttpFreshness', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    globalThis.fetch = ORIGINAL_FETCH;
  });

  it("returns 'fresh' when ETag matches", async () => {
    globalThis.fetch = vi.fn(async () =>
      headResponse({ etag: '"v1"', 'content-length': '100' }),
    ) as any;
    const f = createHttpFreshness();
    const v = await f.check(
      { url: 'https://x/' },
      { url: 'https://x/', etag: '"v1"', content_length: 100 },
      ctx,
    );
    expect(v).toBe('fresh');
  });

  it("returns 'stale' when ETag mismatches", async () => {
    globalThis.fetch = vi.fn(async () => headResponse({ etag: '"v2"' })) as any;
    const f = createHttpFreshness();
    const v = await f.check({ url: 'https://x/' }, { url: 'https://x/', etag: '"v1"' }, ctx);
    expect(v).toBe('stale');
  });

  it('falls back to Last-Modified when ETag absent', async () => {
    globalThis.fetch = vi.fn(async () =>
      headResponse({ 'last-modified': 'Wed, 01 Jan 2025 00:00:00 GMT' }),
    ) as any;
    const f = createHttpFreshness();
    const fresh = await f.check(
      { url: 'https://x/' },
      { url: 'https://x/', last_modified: 'Wed, 01 Jan 2025 00:00:00 GMT' },
      ctx,
    );
    expect(fresh).toBe('fresh');

    const stale = await f.check(
      { url: 'https://x/' },
      { url: 'https://x/', last_modified: 'Tue, 31 Dec 2024 00:00:00 GMT' },
      ctx,
    );
    expect(stale).toBe('stale');
  });

  it('falls back to Content-Length when ETag and Last-Modified absent', async () => {
    globalThis.fetch = vi.fn(async () => headResponse({ 'content-length': '500' })) as any;
    const f = createHttpFreshness();
    const fresh = await f.check(
      { url: 'https://x/' },
      { url: 'https://x/', content_length: 500 },
      ctx,
    );
    expect(fresh).toBe('fresh');

    const stale = await f.check(
      { url: 'https://x/' },
      { url: 'https://x/', content_length: 400 },
      ctx,
    );
    expect(stale).toBe('stale');
  });

  it("returns 'unknown' when no comparable headers exist", async () => {
    globalThis.fetch = vi.fn(async () => headResponse({})) as any;
    const f = createHttpFreshness();
    const v = await f.check({ url: 'https://x/' }, { url: 'https://x/' }, ctx);
    expect(v).toBe('unknown');
  });

  it("returns 'unknown' on HEAD HTTP error", async () => {
    globalThis.fetch = vi.fn(async () => headResponse({}, 500)) as any;
    const f = createHttpFreshness();
    const v = await f.check({ url: 'https://x/' }, { url: 'https://x/' }, ctx);
    expect(v).toBe('unknown');
  });

  it("returns 'unknown' when fetch throws", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error('network down');
    }) as any;
    const f = createHttpFreshness();
    const v = await f.check({ url: 'https://x/' }, { url: 'https://x/' }, ctx);
    expect(v).toBe('unknown');
  });

  it('inspect returns the full result with reason and headers', async () => {
    globalThis.fetch = vi.fn(async () =>
      headResponse({ etag: '"server"', 'content-length': '999' }),
    ) as any;
    const f = createHttpFreshness();
    const r = await f.inspect({ url: 'https://x/' }, { url: 'https://x/', etag: '"client"' }, ctx);
    expect(r.verdict).toBe('stale');
    expect(r.reason).toContain('ETag');
    expect(r.serverHeaders.etag).toBe('"server"');
    expect(r.serverHeaders.content_length).toBe(999);
  });
});
