/**
 * Sonae pipeline assembly.
 *
 * Wires the four Sonae layer adapters together with file-system caches and
 * HTTP HEAD freshness, exposing a single `runSonaePipeline()` entrypoint.
 *
 * This file is the "configuration" layer — what changes when you fork Sonae
 * for a new domain. Compare with `examples/news-summarizer/` for an alternate
 * configuration of the same `Pipeline` class.
 */

import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

import {
  BinaryFileCache,
  JsonFileCache,
  Pipeline,
  TextFileCache,
  createHttpFreshness,
  type EmitFn,
  type Freshness,
  type HttpSourceMeta,
  type PipelineContext,
  type ProgressEvent as PipelineProgressEvent,
  type RunOptions,
} from '@/lib/core';

import { SonaeDiscoverer } from './discoverer';
import { SonaePdfRetriever } from './retriever';
import { SonaeTocOcrParser } from './parser';
import { SonaeMapReduceExtractor } from './extractor';
import { findByCode } from './municipality';
import type { DisasterAssessment, NextActions } from './schemas';
import type { SonaeBlob, SonaeParsed, SonaeQuery, SonaeSource } from './types';

// =============================================================================
// SonaeSource → freshness adapter (maps `pdf_url` to the generic `url` field)
// =============================================================================
function adaptHttpFreshness(
  inner: Freshness<{ url: string }, HttpSourceMeta>,
): Freshness<SonaeSource, HttpSourceMeta> {
  return {
    check: (source, cached, ctx) =>
      inner.check(
        { url: source.pdf_url },
        cached,
        // The inner checker only reads `signal` from the context; widening the
        // typed source on the outer ctx is safe.
        ctx as unknown as PipelineContext<unknown, { url: string }>,
      ),
  };
}

// =============================================================================
// Cache root resolution (deploy-portable)
// =============================================================================
function cacheRoot(): string {
  return process.env.SONAE_CACHE_DIR
    ? resolve(process.env.SONAE_CACHE_DIR)
    : join(process.cwd(), 'cache');
}

function ensureCacheDirs(root: string) {
  for (const sub of ['municipalities', 'pdfs', 'discovery', 'toc', 'ocr', 'work']) {
    mkdirSync(join(root, sub), { recursive: true });
  }
}

// =============================================================================
// Composite parsed-cache (text body + JSON metadata, atomic pair)
// =============================================================================
class ParsedCompositeCache {
  private readonly mdCache: TextFileCache;
  private readonly metaCache: JsonFileCache<{
    section: SonaeParsed['section'];
    scanned_pages: number[];
    source_sha256: string;
    source: SonaeSource;
  }>;

  constructor(dir: string) {
    this.mdCache = new TextFileCache({ dir, ext: 'md' });
    this.metaCache = new JsonFileCache({
      dir,
      ext: 'json',
      filename: (k) => `${k}.meta.json`,
    });
  }

  async read(key: string, ctx: PipelineContext): Promise<SonaeParsed | null> {
    const md = await this.mdCache.read(key, ctx);
    const meta = await this.metaCache.read(key, ctx);
    if (md === null || meta === null) return null;
    return {
      ocr_markdown: md,
      section: meta.section,
      scanned_pages: meta.scanned_pages,
      source_sha256: meta.source_sha256,
      source: meta.source,
    };
  }

  async write(key: string, value: SonaeParsed, ctx: PipelineContext): Promise<void> {
    await this.mdCache.write(key, value.ocr_markdown, ctx);
    await this.metaCache.write(
      key,
      {
        section: value.section,
        scanned_pages: value.scanned_pages,
        source_sha256: value.source_sha256,
        source: value.source,
      },
      ctx,
    );
  }

  async invalidate(key: string, ctx: PipelineContext): Promise<void> {
    await this.mdCache.invalidate(key, ctx);
    await this.metaCache.invalidate(key, ctx);
  }
}

// =============================================================================
// Blob cache: keep PDF on disk, surface a SonaeBlob handle in memory
// =============================================================================
class PdfBlobCache {
  private readonly metaCache: JsonFileCache<SonaeBlob>;

  constructor(private readonly dir: string) {
    this.metaCache = new JsonFileCache({
      dir,
      ext: 'json',
      filename: (k) => `${k}.meta.json`,
    });
  }

  pdfPath(key: string): string {
    return join(this.dir, `${key}.pdf`);
  }

  async read(key: string, ctx: PipelineContext): Promise<SonaeBlob | null> {
    const meta = await this.metaCache.read(key, ctx);
    if (!meta) return null;
    return { ...meta, pdf_path: this.pdfPath(key) };
  }

  async write(key: string, value: SonaeBlob, ctx: PipelineContext): Promise<void> {
    // The retriever has already written the PDF to value.pdf_path.
    // We persist only the metadata; the bytes live at the path itself.
    await this.metaCache.write(key, value, ctx);
  }

  async invalidate(key: string, ctx: PipelineContext): Promise<void> {
    await this.metaCache.invalidate(key, ctx);
    await new BinaryFileCache({ dir: this.dir, ext: 'pdf' }).invalidate(key, ctx);
  }
}

// =============================================================================
// Configured Pipeline (singleton, 2 系統)
//   strict          — frontend 向け。テキストレイヤ無し PDF は throw
//   full_ocr_fallback — admin 向け。テキストレイヤ無し PDF は全ページ OCR
// 両系統で cache (PDF/OCR/result) は同じファイルを共有する。
// =============================================================================
type SonaePipeline = Pipeline<
  SonaeQuery,
  SonaeSource,
  SonaeBlob,
  HttpSourceMeta,
  SonaeParsed,
  DisasterAssessment
>;

let _pipelineStrict: SonaePipeline | null = null;
let _pipelineFullOcr: SonaePipeline | null = null;

import { getLlm } from './llmRoles';

function buildPipeline(mode: 'strict' | 'full_ocr_fallback'): SonaePipeline {
  const root = cacheRoot();
  ensureCacheDirs(root);

  const parsedCache = new ParsedCompositeCache(join(root, 'ocr'));
  const blobCache = new PdfBlobCache(join(root, 'pdfs'));
  const sourceCache = new JsonFileCache<SonaeSource>({
    dir: join(root, 'discovery'),
    ext: 'json',
  });
  const resultCache = new JsonFileCache<DisasterAssessment>({
    dir: join(root, 'municipalities'),
    ext: 'json',
  });
  const blobMetaCache = new JsonFileCache<HttpSourceMeta>({
    dir: join(root, 'pdfs'),
    ext: 'json',
    filename: (k) => `${k}.http.json`,
  });

  const discoverer = new SonaeDiscoverer({
    llm: getLlm('discovery'),
    headless: process.env.BROWSER_USE_HEADLESS === 'true',
  });

  const retriever = new SonaePdfRetriever({
    pdfPathFor: (code) => blobCache.pdfPath(code),
  });

  const parser = new SonaeTocOcrParser({
    llm: getLlm('main'),
    tocLlm: getLlm('toc'),
    ocr: getLlm('ocr'),
    workDirFor: (code, sha256) => {
      const dir = join(root, 'work', `${code}_${sha256.slice(0, 12)}_${Date.now()}`);
      mkdirSync(dir, { recursive: true });
      return dir;
    },
    mode,
  });

  const extractor = new SonaeMapReduceExtractor({
    llm: getLlm('main'),
    stepALlm: getLlm('step_a'),
  });

  return new Pipeline<
    SonaeQuery,
    SonaeSource,
    SonaeBlob,
    HttpSourceMeta,
    SonaeParsed,
    DisasterAssessment
  >({
    name: mode === 'strict' ? 'sonae-disaster-plan' : 'sonae-disaster-plan-admin',
    discoverer,
    retriever,
    parser,
    extractor,
    cacheKey: (q) => q.municipality_code,
    caches: {
      source: sourceCache,
      blob: blobCache,
      blobMeta: blobMetaCache,
      parsed: parsedCache,
      result: resultCache,
      invalidateDownstream: async (key, ctx) => {
        await parsedCache.invalidate(key, ctx);
        await resultCache.invalidate(key, ctx);
      },
    },
    freshness: adaptHttpFreshness(createHttpFreshness<{ url: string }>()),
    getBlobMeta: (blob) => blob.http,
  });
}

export function getSonaePipeline(): SonaePipeline {
  return (_pipelineStrict ??= buildPipeline('strict'));
}

export function getSonaePipelineForAdmin(): SonaePipeline {
  return (_pipelineFullOcr ??= buildPipeline('full_ocr_fallback'));
}

export interface SonaeRunOptions {
  emit: EmitFn;
  signal?: AbortSignal;
  /** Bypass all caches. */
  force?: boolean;
  /** Bypass parsed + result caches but keep PDF / Discovery. */
  forceParseAndExtract?: boolean;
  /** @deprecated Renamed to `forceParseAndExtract`. */
  forceExtract?: boolean;
  /** registry に未登録の自治体を実行する時に呼出側が補う city name。 */
  cityName?: string;
  /** registry に未登録の自治体を実行する時に呼出側が補う prefecture (例: 神奈川県)。 */
  prefecture?: string;
}

/**
 * Run the Sonae pipeline for a municipality code.
 *
 * Resolves the city name from the registry. Throws if the code is unknown.
 */
export async function runSonaePipeline(
  code: string,
  opts: SonaeRunOptions,
): Promise<DisasterAssessment> {
  return await runWith(getSonaePipeline(), code, opts);
}

/**
 * admin 経路。テキストレイヤ無し PDF を受け取った場合に全ページ OCR
 * フォールバックする以外、通常の `runSonaePipeline` と同等。cache は frontend と
 * 共有されるため、admin が温めた cache はそのまま frontend からヒットする。
 */
export async function runSonaePipelineAsAdmin(
  code: string,
  opts: SonaeRunOptions,
): Promise<DisasterAssessment> {
  return await runWith(getSonaePipelineForAdmin(), code, opts);
}

interface InflightJob {
  promise: Promise<DisasterAssessment>;
  log: PipelineProgressEvent[];
  subscribers: Set<EmitFn>;
  controller: AbortController;
}

const _inflight = new Map<string, InflightJob>();

async function runWith(
  pipeline: SonaePipeline,
  code: string,
  opts: SonaeRunOptions,
): Promise<DisasterAssessment> {
  const muni = findByCode(code);
  const cityName = muni?.name ?? opts.cityName;
  if (!cityName) throw new Error(`unknown municipality code: ${code}`);
  const prefecture = muni?.prefecture ?? opts.prefecture;
  const query: SonaeQuery = {
    municipality_code: code,
    city_name: cityName,
    prefecture,
  };

  const dedupeKey = `${pipeline.config.name}:${opts.force ? 'force' : 'normal'}:${code}`;

  // 各 subscriber は自分の req.signal が abort された時に「離脱」する。
  // 全員が離脱したら job 内 controller を abort し、pipeline を止める。
  // 個別離脱では止まらない (B 側だけ生きていれば pipeline 継続)。
  const attachLeave = (job: InflightJob) => {
    const onLeave = () => {
      job.subscribers.delete(opts.emit);
      if (job.subscribers.size === 0) job.controller.abort();
    };
    opts.signal?.addEventListener('abort', onLeave);
    return () => {
      opts.signal?.removeEventListener('abort', onLeave);
      onLeave();
    };
  };

  const existing = _inflight.get(dedupeKey);
  if (existing) {
    for (const ev of existing.log) opts.emit(ev);
    existing.subscribers.add(opts.emit);
    const detach = attachLeave(existing);
    try {
      return await existing.promise;
    } finally {
      detach();
    }
  }

  const controller = new AbortController();
  const job: InflightJob = {
    promise: undefined as unknown as Promise<DisasterAssessment>,
    log: [],
    subscribers: new Set([opts.emit]),
    controller,
  };

  const broadcast: EmitFn = (event) => {
    job.log.push(event);
    for (const sub of job.subscribers) {
      try {
        sub(event);
      } catch {
        /* subscriber 切断は無視 */
      }
    }
  };

  const runOpts: RunOptions = {
    emit: broadcast,
    signal: controller.signal,
    force: opts.force,
    forceParseAndExtract: opts.forceParseAndExtract ?? opts.forceExtract,
  };

  job.promise = pipeline.run(query, runOpts);
  _inflight.set(dedupeKey, job);
  const detach = attachLeave(job);
  try {
    return await job.promise;
  } finally {
    detach();
    _inflight.delete(dedupeKey);
  }
}

export type { DisasterAssessment, NextActions };

/**
 * Read the cached final assessment for a municipality.
 * Returns `null` if no result has been computed (run the pipeline first).
 */
export async function readSonaeResult(code: string): Promise<DisasterAssessment | null> {
  const root = cacheRoot();
  ensureCacheDirs(root);
  const cache = new JsonFileCache<DisasterAssessment>({
    dir: join(root, 'municipalities'),
    ext: 'json',
  });
  // The cache implementation does not use ctx; pass a stub.
  return await cache.read(code, {
    query: { municipality_code: code, city_name: '' } satisfies SonaeQuery,
    emit: () => {},
  });
}
