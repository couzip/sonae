/**
 * Integration test for the generic Pipeline class.
 *
 * Uses in-memory caches and stubbed layers to verify the cache-tier behaviour:
 * result hit, parsed hit, source/blob reuse, freshness invalidation cascade.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  Pipeline,
  type Cache,
  type Discoverer,
  type Extractor,
  type Freshness,
  type Parser,
  type PipelineContext,
  type ProgressEvent,
  type Retriever,
} from './index';

interface Q {
  id: string;
}
interface S {
  ref: string;
}
interface B {
  body: string;
  hash: string;
}
interface BMeta {
  hash: string;
}
interface P {
  text: string;
}
interface R {
  summary: string;
  source_hash: string;
}

class MemoryCache<V> implements Cache<string, V> {
  private store = new Map<string, V>();
  reads = 0;
  writes = 0;
  invalidates = 0;
  async read(key: string, _ctx: PipelineContext): Promise<V | null> {
    this.reads++;
    return this.store.has(key) ? (this.store.get(key) as V) : null;
  }
  async write(key: string, value: V, _ctx: PipelineContext): Promise<void> {
    this.writes++;
    this.store.set(key, value);
  }
  async invalidate(key: string, _ctx: PipelineContext): Promise<void> {
    this.invalidates++;
    this.store.delete(key);
  }
  has(key: string) {
    return this.store.has(key);
  }
}

class CountingDiscoverer implements Discoverer<Q, S> {
  calls = 0;
  async discover(q: Q): Promise<S> {
    this.calls++;
    return { ref: `ref-${q.id}` };
  }
}

class CountingRetriever implements Retriever<S, B> {
  calls = 0;
  hash = 'h1';
  async retrieve(s: S): Promise<B> {
    this.calls++;
    return { body: `body-of-${s.ref}`, hash: this.hash };
  }
}

class CountingParser implements Parser<B, P> {
  calls = 0;
  async parse(b: B): Promise<P> {
    this.calls++;
    return { text: b.body.toUpperCase() };
  }
}

class CountingExtractor implements Extractor<P, R> {
  calls = 0;
  async extract(p: P, _ctx: PipelineContext): Promise<R> {
    this.calls++;
    return { summary: `sum:${p.text}`, source_hash: 'unused' };
  }
}

function buildPipeline(
  opts: {
    freshness?: Freshness<S, BMeta>;
  } = {},
) {
  const sourceCache = new MemoryCache<S>();
  const blobCache = new MemoryCache<B>();
  const blobMetaCache = new MemoryCache<BMeta>();
  const parsedCache = new MemoryCache<P>();
  const resultCache = new MemoryCache<R>();
  const discoverer = new CountingDiscoverer();
  const retriever = new CountingRetriever();
  const parser = new CountingParser();
  const extractor = new CountingExtractor();

  let invalidateCascadeCalls = 0;

  const pipeline = new Pipeline<Q, S, B, BMeta, P, R>({
    name: 'test',
    discoverer,
    retriever,
    parser,
    extractor,
    cacheKey: (q) => q.id,
    caches: {
      source: sourceCache,
      blob: blobCache,
      blobMeta: blobMetaCache,
      parsed: parsedCache,
      result: resultCache,
      invalidateDownstream: async (key, ctx) => {
        invalidateCascadeCalls++;
        await parsedCache.invalidate(key, ctx);
        await resultCache.invalidate(key, ctx);
      },
    },
    freshness: opts.freshness,
    getBlobMeta: (b) => ({ hash: b.hash }),
  });

  return {
    pipeline,
    discoverer,
    retriever,
    parser,
    extractor,
    sourceCache,
    blobCache,
    blobMetaCache,
    parsedCache,
    resultCache,
    cascadeRef: { get: () => invalidateCascadeCalls },
  };
}

const events: ProgressEvent[] = [];
const emit = (e: ProgressEvent) => events.push(e);

describe('Pipeline', () => {
  beforeEach(() => {
    events.length = 0;
  });

  it('runs all four layers on cold cache', async () => {
    const env = buildPipeline();
    const r = await env.pipeline.run({ id: 'q1' }, { emit });
    expect(r).toEqual({ summary: 'sum:BODY-OF-REF-Q1', source_hash: 'unused' });
    expect(env.discoverer.calls).toBe(1);
    expect(env.retriever.calls).toBe(1);
    expect(env.parser.calls).toBe(1);
    expect(env.extractor.calls).toBe(1);
  });

  it('result-cache hit returns immediately and skips all layers', async () => {
    const env = buildPipeline();
    await env.pipeline.run({ id: 'q1' }, { emit });
    // Re-run
    events.length = 0;
    const r = await env.pipeline.run({ id: 'q1' }, { emit });
    expect(r.summary).toBe('sum:BODY-OF-REF-Q1');
    // Layer call counts unchanged
    expect(env.discoverer.calls).toBe(1);
    expect(env.retriever.calls).toBe(1);
    expect(env.parser.calls).toBe(1);
    expect(env.extractor.calls).toBe(1);
    // Cache hit event should be in the stream
    expect(events.some((e) => e.type === 'cache_hit' && (e as any).layer === 'result')).toBe(true);
  });

  it('parsed-cache hit re-runs Extractor only', async () => {
    const env = buildPipeline();
    const ctx: PipelineContext = { emit };
    await env.pipeline.run({ id: 'q1' }, { emit });
    // Manually clear the result cache only
    await env.resultCache.invalidate('q1', ctx);
    events.length = 0;
    await env.pipeline.run({ id: 'q1' }, { emit });
    expect(env.discoverer.calls).toBe(1); // unchanged
    expect(env.retriever.calls).toBe(1);
    expect(env.parser.calls).toBe(1);
    expect(env.extractor.calls).toBe(2); // re-ran
    expect(events.some((e) => e.type === 'cache_hit' && (e as any).layer === 'parsed')).toBe(true);
  });

  it('source-cache hit skips Discovery', async () => {
    const env = buildPipeline();
    const ctx: PipelineContext = { emit };
    await env.pipeline.run({ id: 'q1' }, { emit });
    await env.resultCache.invalidate('q1', ctx);
    await env.parsedCache.invalidate('q1', ctx);
    events.length = 0;
    await env.pipeline.run({ id: 'q1' }, { emit });
    expect(env.discoverer.calls).toBe(1); // skipped via source cache
    expect(env.retriever.calls).toBe(1); // blob cached too
    expect(env.parser.calls).toBe(2);
    expect(env.extractor.calls).toBe(2);
  });

  it('blob-cache hit skips Retrieval', async () => {
    const env = buildPipeline();
    const ctx: PipelineContext = { emit };
    await env.pipeline.run({ id: 'q1' }, { emit });
    await env.resultCache.invalidate('q1', ctx);
    await env.parsedCache.invalidate('q1', ctx);
    events.length = 0;
    await env.pipeline.run({ id: 'q1' }, { emit });
    expect(env.retriever.calls).toBe(1); // unchanged
  });

  it('force=true bypasses all caches', async () => {
    const env = buildPipeline();
    await env.pipeline.run({ id: 'q1' }, { emit });
    await env.pipeline.run({ id: 'q1' }, { emit, force: true });
    expect(env.discoverer.calls).toBe(2);
    expect(env.retriever.calls).toBe(2);
    expect(env.parser.calls).toBe(2);
    expect(env.extractor.calls).toBe(2);
  });

  it('forceExtract bypasses parsed + result, keeps upstream', async () => {
    const env = buildPipeline();
    await env.pipeline.run({ id: 'q1' }, { emit });
    events.length = 0;
    await env.pipeline.run({ id: 'q1' }, { emit, forceExtract: true });
    expect(env.discoverer.calls).toBe(1);
    expect(env.retriever.calls).toBe(1); // blob cached
    expect(env.parser.calls).toBe(2); // re-parsed
    expect(env.extractor.calls).toBe(2); // re-extracted
  });

  it("freshness 'stale' invalidates downstream and re-runs everything", async () => {
    const freshness: Freshness<S, BMeta> = {
      check: async () => 'stale',
    };
    const env = buildPipeline({ freshness });
    await env.pipeline.run({ id: 'q1' }, { emit });
    events.length = 0;
    await env.pipeline.run({ id: 'q1' }, { emit });
    // Freshness was 'stale' on second run → cascade invalidate, re-run all
    expect(env.cascadeRef.get()).toBe(1);
    expect(env.parser.calls).toBe(2);
    expect(env.extractor.calls).toBe(2);
  });

  it("freshness 'fresh' lets caches stand", async () => {
    const freshness: Freshness<S, BMeta> = { check: async () => 'fresh' };
    const env = buildPipeline({ freshness });
    await env.pipeline.run({ id: 'q1' }, { emit });
    await env.pipeline.run({ id: 'q1' }, { emit });
    expect(env.cascadeRef.get()).toBe(0);
    expect(env.extractor.calls).toBe(1);
  });
});
