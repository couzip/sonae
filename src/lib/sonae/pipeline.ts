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
  createLlmClient,
  type EmitFn,
  type Freshness,
  type HttpSourceMeta,
  type LlmClient,
  type PipelineContext,
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
// Configured Pipeline (singleton)
// =============================================================================
let _pipeline: Pipeline<
  SonaeQuery,
  SonaeSource,
  SonaeBlob,
  HttpSourceMeta,
  SonaeParsed,
  DisasterAssessment
> | null = null;

let _llm: LlmClient | null = null;
let _ocr: LlmClient | null = null;

function getLlm(): LlmClient {
  if (!_llm) {
    _llm = createLlmClient({
      baseURL: process.env.LLM_BASE_URL ?? 'http://localhost:1234/v1',
      apiKey: process.env.LLM_API_KEY ?? 'not-needed',
      model: process.env.LLM_MODEL ?? 'gemma-4-e4b-it@q4_k_s',
    });
  }
  return _llm;
}

function getOcr(): LlmClient {
  if (!_ocr) {
    _ocr = createLlmClient({
      baseURL: process.env.OCR_BASE_URL ?? 'http://localhost:1234/v1',
      apiKey: process.env.OCR_API_KEY ?? 'not-needed',
      model: process.env.OCR_MODEL ?? 'enginil/dots.mocr',
    });
  }
  return _ocr;
}

export function getSonaePipeline() {
  if (_pipeline) return _pipeline;

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
    llmBaseURL: process.env.LLM_BASE_URL ?? 'http://localhost:1234/v1',
    llmApiKey: process.env.LLM_API_KEY ?? 'not-needed',
    llmModel: process.env.LLM_MODEL ?? 'gemma-4-e4b-it@q4_k_s',
    headless: process.env.BROWSER_USE_HEADLESS !== 'false',
  });

  const retriever = new SonaePdfRetriever({
    pdfPathFor: (code) => blobCache.pdfPath(code),
  });

  const parser = new SonaeTocOcrParser({
    llm: getLlm(),
    ocr: getOcr(),
    workDirFor: (code, sha256) => {
      const dir = join(root, 'work', `${code}_${sha256.slice(0, 12)}_${Date.now()}`);
      mkdirSync(dir, { recursive: true });
      return dir;
    },
  });

  const extractor = new SonaeMapReduceExtractor({ llm: getLlm() });

  _pipeline = new Pipeline<
    SonaeQuery,
    SonaeSource,
    SonaeBlob,
    HttpSourceMeta,
    SonaeParsed,
    DisasterAssessment
  >({
    name: 'sonae-disaster-plan',
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
        // PDF が更新されたら派生キャッシュをすべて無効化
        await parsedCache.invalidate(key, ctx);
        await resultCache.invalidate(key, ctx);
      },
    },
    freshness: adaptHttpFreshness(createHttpFreshness<{ url: string }>()),
    getBlobMeta: (blob) => blob.http,
  });

  return _pipeline;
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
  const muni = findByCode(code);
  if (!muni) throw new Error(`unknown municipality code: ${code}`);
  const query: SonaeQuery = { municipality_code: code, city_name: muni.name };
  const pipeline = getSonaePipeline();
  const runOpts: RunOptions = {
    emit: opts.emit,
    signal: opts.signal,
    force: opts.force,
    forceParseAndExtract: opts.forceParseAndExtract ?? opts.forceExtract,
  };
  return await pipeline.run(query, runOpts);
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
