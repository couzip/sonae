/**
 * Generic Pipeline runner.
 *
 * Orchestrates the four layers (Discover → Retrieve → Parse → Extract) with up
 * to five cache tiers and emits progress events along the way. Domain-specific
 * pipelines (Sonae, news-summarizer, drug-label, regulation-summary, …) are
 * just instances of this class with concrete layer implementations.
 *
 * Cache priority (highest leverage first):
 *   1. result:  if a final TResult is cached, return it immediately
 *   2. parsed:  skip layers 1-3 (Discovery, Retrieval, Parser), only Extract
 *   3. source:  skip Discovery only
 *   4. blob:    skip Retrieval only (with optional freshness check)
 *
 * Freshness:
 *   If a `freshness` checker is provided AND a cached source meta exists, it is
 *   consulted before reusing the cached blob/parsed/result. A `stale` verdict
 *   invalidates the downstream caches via `caches.invalidateDownstream`.
 */

import type { EmitFn } from './events';
import type {
  Cache,
  Discoverer,
  Extractor,
  Freshness,
  Parser,
  PipelineContext,
  Retriever,
} from './types';

export interface PipelineCaches<TSource, TBlob, TParsed, TResult> {
  source?: Cache<string, TSource>;
  blob?: Cache<string, TBlob>;
  blobMeta?: Cache<string, unknown>; // freshness 用 (Last-Modified, ETag etc.)
  parsed?: Cache<string, TParsed>;
  result?: Cache<string, TResult>;
  /**
   * Called when freshness comes back `stale`. Implementation should invalidate
   * blob/parsed/result entries derived from this source.
   */
  invalidateDownstream?: (key: string, ctx: PipelineContext) => Promise<void>;
}

export interface PipelineConfig<TQuery, TSource, TBlob, TBlobMeta, TParsed, TResult> {
  /** Human name for logs / events (e.g. "sonae-disaster-plan"). */
  name: string;
  discoverer: Discoverer<TQuery, TSource>;
  retriever: Retriever<TSource, TBlob, TQuery>;
  parser: Parser<TBlob, TParsed, TQuery, TSource>;
  extractor: Extractor<TParsed, TResult, TQuery, TSource>;
  /** Stable cache key for this query (e.g. municipality code). */
  cacheKey: (query: TQuery) => string;
  caches?: PipelineCaches<TSource, TBlob, TParsed, TResult>;
  /** Optional source-level freshness check (HTTP HEAD or similar). */
  freshness?: Freshness<TSource, TBlobMeta>;
  /** Get the meta blob from a TBlob to feed freshness check. */
  getBlobMeta?: (blob: TBlob) => TBlobMeta | undefined;
}

export interface RunOptions {
  emit: EmitFn;
  signal?: AbortSignal;
  workDir?: string;
  /** Bypass all caches (full re-run). */
  force?: boolean;
  /**
   * Bypass parsed and result caches but reuse Discovery / PDF caches.
   * Re-runs Parser + Extractor. Useful when only the prompt or the schema
   * changed but the source document is unchanged.
   */
  forceParseAndExtract?: boolean;
  /**
   * @deprecated Renamed to `forceParseAndExtract` for clarity (the flag
   * actually re-runs both Parser and Extractor). Kept as alias for one
   * release; remove after 0.2.
   */
  forceExtract?: boolean;
}

export class Pipeline<TQuery, TSource, TBlob, TBlobMeta, TParsed, TResult> {
  constructor(
    public readonly config: PipelineConfig<TQuery, TSource, TBlob, TBlobMeta, TParsed, TResult>,
  ) {}

  async run(query: TQuery, opts: RunOptions): Promise<TResult> {
    const { emit, signal, workDir, force = false } = opts;
    const forceParseAndExtract = opts.forceParseAndExtract ?? opts.forceExtract ?? false;
    const key = this.config.cacheKey(query);
    const ctx: PipelineContext<TQuery, TSource> = { query, emit, signal, workDir };
    const caches = this.config.caches ?? {};

    // ---------------------------------------------------------------
    // Freshness pre-check (only if blob is cached and freshness is configured)
    // ---------------------------------------------------------------
    let stale = false;
    if (!force && this.config.freshness && caches.blob && caches.blobMeta) {
      const cachedMeta = (await caches.blobMeta.read(key, ctx)) as TBlobMeta | null;
      const cachedSource = caches.source ? await caches.source.read(key, ctx) : null;
      if (cachedMeta && cachedSource) {
        ctx.source = cachedSource;
        const verdict = await this.config.freshness.check(cachedSource, cachedMeta, ctx);
        emit({ type: 'log', message: `[${this.config.name}/freshness] ${verdict}` });
        if (verdict === 'stale') {
          stale = true;
          if (caches.invalidateDownstream) {
            await caches.invalidateDownstream(key, ctx);
          }
        }
      }
    }

    // ---------------------------------------------------------------
    // Layer 1: result cache (also bypassed by `forceParseAndExtract` since the
    // user explicitly wants to re-run the Extractor)
    // ---------------------------------------------------------------
    if (!force && !forceParseAndExtract && !stale && caches.result) {
      const cached = await caches.result.read(key, ctx);
      if (cached !== null) {
        emit({ type: 'cache_hit', layer: 'result', data: cached });
        emit({ type: 'result', data: cached });
        return cached;
      }
    }

    // ---------------------------------------------------------------
    // Layer 2: parsed cache → run Extractor only
    // ---------------------------------------------------------------
    if (!force && !forceParseAndExtract && !stale && caches.parsed) {
      const parsed = await caches.parsed.read(key, ctx);
      if (parsed !== null) {
        emit({ type: 'cache_hit', layer: 'parsed' });
        const result = await this.config.extractor.extract(parsed, ctx);
        if (caches.result) await caches.result.write(key, result, ctx);
        emit({ type: 'result', data: result });
        return result;
      }
    }

    // ---------------------------------------------------------------
    // Discover (or skip via source cache)
    // ---------------------------------------------------------------
    let source: TSource;
    if (!force && caches.source) {
      const cached = await caches.source.read(key, ctx);
      if (cached !== null) {
        emit({ type: 'cache_hit', layer: 'source' });
        source = cached;
      } else {
        source = await this.config.discoverer.discover(query, ctx);
        await caches.source.write(key, source, ctx);
      }
    } else {
      source = await this.config.discoverer.discover(query, ctx);
      if (caches.source) await caches.source.write(key, source, ctx);
    }
    // Make `source` visible to downstream layers via context.
    ctx.source = source;

    // ---------------------------------------------------------------
    // Retrieve (or skip via blob cache)
    // ---------------------------------------------------------------
    let blob: TBlob;
    if (!force && !stale && caches.blob) {
      const cached = await caches.blob.read(key, ctx);
      if (cached !== null) {
        emit({ type: 'cache_hit', layer: 'blob' });
        blob = cached;
      } else {
        blob = await this.config.retriever.retrieve(source, ctx);
        await caches.blob.write(key, blob, ctx);
        if (this.config.getBlobMeta && caches.blobMeta) {
          const meta = this.config.getBlobMeta(blob);
          if (meta !== undefined) await caches.blobMeta.write(key, meta, ctx);
        }
      }
    } else {
      blob = await this.config.retriever.retrieve(source, ctx);
      if (caches.blob) await caches.blob.write(key, blob, ctx);
      if (this.config.getBlobMeta && caches.blobMeta) {
        const meta = this.config.getBlobMeta(blob);
        if (meta !== undefined) await caches.blobMeta.write(key, meta, ctx);
      }
    }

    // ---------------------------------------------------------------
    // Parse → Extract → Result
    // ---------------------------------------------------------------
    const parsed = await this.config.parser.parse(blob, ctx);
    if (caches.parsed) await caches.parsed.write(key, parsed, ctx);

    const result = await this.config.extractor.extract(parsed, ctx);
    if (caches.result) await caches.result.write(key, result, ctx);

    emit({ type: 'result', data: result });
    return result;
  }
}
