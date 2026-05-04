/**
 * Pipeline layer interfaces.
 *
 * A pipeline takes a `TQuery`, discovers a `TSource`, retrieves it as a `TBlob`,
 * parses the blob to `TParsed`, then extracts a structured `TResult`.
 *
 * Each layer is independently swappable and cacheable.
 */

import type { EmitFn } from './events';

/**
 * Per-run execution context, threaded through every layer.
 *
 * `query` is populated by `Pipeline.run` for every layer call. `source` is
 * populated after Discovery returns. Both are optional in the type because
 * stand-alone helpers (e.g. cache reads outside a pipeline run) can pass a
 * minimal `{ emit }` context.
 *
 * Use generics to get strong typing inside your layer implementations:
 * `parse(blob: SonaeBlob, ctx: PipelineContext<SonaeQuery, SonaeSource>)`.
 * In that signature, `ctx.query` is non-null because `Pipeline.run` populates
 * it before invoking the parser.
 */
export interface PipelineContext<TQuery = unknown, TSource = unknown> {
  /** Populated by `Pipeline.run` before invoking any layer. */
  query?: TQuery;
  /** Populated by `Pipeline.run` after the Discoverer returns. */
  source?: TSource;
  emit: EmitFn;
  signal?: AbortSignal;
  /** Implementation-defined work directory for ephemeral artifacts. */
  workDir?: string;
}

/**
 * Discoverer: query → source descriptor.
 *
 * Examples:
 * - municipality code → official PDF URL (Sonae)
 * - drug name → label PDF URL (medical reference impl)
 * - regulation ID → gov.uk page URL (legal reference impl)
 */
export interface Discoverer<TQuery, TSource> {
  discover(query: TQuery, ctx: PipelineContext<TQuery>): Promise<TSource>;
}

/**
 * Retriever: source descriptor → local blob handle.
 *
 * The blob is whatever the parser needs as input — usually a file path on disk
 * (PDF, HTML snapshot) but could be a buffer or a stream descriptor.
 *
 * If the implementation supports freshness checks, it should also implement
 * the optional `Freshness` interface.
 */
export interface Retriever<TSource, TBlob, TQuery = unknown> {
  retrieve(source: TSource, ctx: PipelineContext<TQuery, TSource>): Promise<TBlob>;
}

export type FreshnessVerdict = 'fresh' | 'stale' | 'unknown';

export interface Freshness<TSource, TBlobMeta> {
  /** Cheap (HEAD-style) check whether a cached blob is still current. */
  check(
    source: TSource,
    cachedMeta: TBlobMeta,
    ctx: PipelineContext<unknown, TSource>,
  ): Promise<FreshnessVerdict>;
}

/**
 * Parser: blob → parsed intermediate representation.
 *
 * For PDFs this is typically OCR'd / TOC-extracted markdown. For HTML it might
 * be a normalized DOM digest. The parser owns whatever heavy text extraction is
 * needed before LLM interpretation.
 */
export interface Parser<TBlob, TParsed, TQuery = unknown, TSource = unknown> {
  parse(blob: TBlob, ctx: PipelineContext<TQuery, TSource>): Promise<TParsed>;
}

/**
 * Extractor: parsed text → structured domain object.
 *
 * Almost always backed by an LLM with a structured-output schema (JSON schema +
 * Zod runtime validation). Map-reduce patterns live here.
 */
export interface Extractor<TParsed, TResult, TQuery = unknown, TSource = unknown> {
  extract(parsed: TParsed, ctx: PipelineContext<TQuery, TSource>): Promise<TResult>;
}

/**
 * Cache: keyed get / set / invalidate.
 *
 * The `Pipeline` class can use up to four cache layers (source / blob / parsed /
 * result). Each is independently optional — pass `null` to disable.
 */
export interface Cache<TKey, TValue> {
  read(key: TKey, ctx: PipelineContext): Promise<TValue | null>;
  write(key: TKey, value: TValue, ctx: PipelineContext): Promise<void>;
  invalidate(key: TKey, ctx: PipelineContext): Promise<void>;
}
