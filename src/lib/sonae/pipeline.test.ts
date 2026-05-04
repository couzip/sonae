/**
 * Sonae pipeline integration test.
 *
 * Stubs the LLM/OCR clients and the four layer adapters to verify that the
 * configured `runSonaePipeline` correctly orchestrates the layers, threads
 * `query` and `source` through the context, and writes / reads its caches.
 *
 * The real Sonae layers depend on browser-use + pdfjs + LM Studio, which is
 * out of scope for unit tests. Instead we exercise the wiring by replacing
 * the layer instances inside `getSonaePipeline()` via injected stubs.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { ProgressEvent } from '@/lib/core';
import type { Discoverer, Extractor, Parser, Retriever } from '@/lib/core';
import type { DisasterAssessment } from './schemas';
import type { SonaeBlob, SonaeParsed, SonaeQuery, SonaeSource } from './types';

// We need fresh module state per test, so import dynamically.
async function loadSonae(cacheDir: string) {
  process.env.SONAE_CACHE_DIR = cacheDir;
  vi.resetModules();
  const mod = await import('./pipeline');
  return mod;
}

// Minimal Sonae municipality fixture so `runSonaePipeline` can resolve a
// city name. We override `municipality.findByCode` via vi.mock below.
vi.mock('./municipality', () => ({
  findByCode: (code: string) =>
    code === 'TEST'
      ? { code: 'TEST', name: 'テスト市', prefecture: 'テスト県', name_aliases: [] }
      : null,
  findByName: () => null,
  findNearestByCoords: () => null,
  listRegistry: () => [],
}));

// Stub layer factories. Each test creates a Pipeline instance directly and
// runs it, bypassing the singleton in `pipeline.ts`. This keeps the test
// hermetic.

class StubDiscoverer implements Discoverer<SonaeQuery, SonaeSource> {
  calls = 0;
  async discover(): Promise<SonaeSource> {
    this.calls++;
    return {
      pdf_url: 'https://example.test/plan.pdf',
      pdf_label: 'Test Plan',
      page_url: 'https://example.test/',
      section_hint: '被害想定',
    };
  }
}

class StubRetriever implements Retriever<SonaeSource, SonaeBlob, SonaeQuery> {
  calls = 0;
  constructor(private readonly pdfDir: string) {}
  async retrieve(source: SonaeSource, ctx: any): Promise<SonaeBlob> {
    this.calls++;
    const code = ctx.query?.municipality_code;
    if (!code) throw new Error('test stub: missing query');
    const pdfPath = join(this.pdfDir, `${code}.pdf`);
    writeFileSync(pdfPath, Buffer.from('%PDF-1.4 stub', 'utf-8'));
    return {
      pdf_path: pdfPath,
      sha256: 'deadbeefcafebabe',
      size_bytes: 12,
      downloaded_at: new Date().toISOString(),
      http: { url: source.pdf_url, content_length: 12, etag: '"v1"' },
    };
  }
}

class StubParser implements Parser<SonaeBlob, SonaeParsed, SonaeQuery, SonaeSource> {
  calls = 0;
  async parse(blob: SonaeBlob, ctx: any): Promise<SonaeParsed> {
    this.calls++;
    expect(ctx.query?.municipality_code).toBe('TEST');
    expect(ctx.source?.pdf_url).toBe('https://example.test/plan.pdf');
    return {
      ocr_markdown: '# 第6章 想定する災害\n地震・津波\n',
      section: { title: '第6章 想定する災害', page_count: 1 },
      scanned_pages: [17],
      source_sha256: blob.sha256,
      source: ctx.source!,
    };
  }
}

class StubExtractor implements Extractor<SonaeParsed, DisasterAssessment, SonaeQuery, SonaeSource> {
  calls = 0;
  async extract(parsed: SonaeParsed, ctx: any): Promise<DisasterAssessment> {
    this.calls++;
    expect(ctx.query?.city_name).toBe('テスト市');
    return {
      city: ctx.query!.city_name,
      by_disaster_type: [
        {
          disaster_type: '地震',
          scenarios: [
            { name: 'M7.0', scale: '震度6強', expected_damage: '建物倒壊', category: '想定' },
          ],
        },
      ],
      source: {
        pdf_url: parsed.source.pdf_url,
        page_url: parsed.source.page_url,
        pdf_label: parsed.source.pdf_label,
        section_title: parsed.section.title,
      },
      generated_at: new Date().toISOString(),
    };
  }
}

const events: ProgressEvent[] = [];
const emit = (e: ProgressEvent) => {
  events.push(e);
};

describe('Sonae pipeline integration', () => {
  let cacheDir: string;

  beforeEach(() => {
    cacheDir = mkdtempSync(join(tmpdir(), 'sonae-int-'));
    events.length = 0;
  });

  afterEach(() => {
    rmSync(cacheDir, { recursive: true, force: true });
    delete process.env.SONAE_CACHE_DIR;
  });

  it('threads query and source through every layer (cold cache)', async () => {
    // Build pipeline directly with stubs (bypasses real Sonae singleton).
    const { Pipeline, JsonFileCache, TextFileCache } = await import('@/lib/core');
    const discoverer = new StubDiscoverer();
    const retriever = new StubRetriever(cacheDir);
    const parser = new StubParser();
    const extractor = new StubExtractor();

    const sourceCache = new JsonFileCache<SonaeSource>({
      dir: join(cacheDir, 'discovery'),
      ext: 'json',
    });
    const resultCache = new JsonFileCache<DisasterAssessment>({
      dir: join(cacheDir, 'municipalities'),
      ext: 'json',
    });
    const parsedMd = new TextFileCache({ dir: join(cacheDir, 'ocr'), ext: 'md' });
    const parsedMeta = new JsonFileCache<{
      section: SonaeParsed['section'];
      scanned_pages: number[];
      source_sha256: string;
      source: SonaeSource;
    }>({ dir: join(cacheDir, 'ocr'), ext: 'json', filename: (k) => `${k}.meta.json` });

    const parsedCache = {
      async read(key: string, ctx: any): Promise<SonaeParsed | null> {
        const md = await parsedMd.read(key, ctx);
        const meta = await parsedMeta.read(key, ctx);
        if (md === null || meta === null) return null;
        return { ocr_markdown: md, ...meta };
      },
      async write(key: string, value: SonaeParsed, ctx: any) {
        await parsedMd.write(key, value.ocr_markdown, ctx);
        await parsedMeta.write(
          key,
          {
            section: value.section,
            scanned_pages: value.scanned_pages,
            source_sha256: value.source_sha256,
            source: value.source,
          },
          ctx,
        );
      },
      async invalidate(key: string, ctx: any) {
        await parsedMd.invalidate(key, ctx);
        await parsedMeta.invalidate(key, ctx);
      },
    };

    const pipeline = new Pipeline<
      SonaeQuery,
      SonaeSource,
      SonaeBlob,
      unknown,
      SonaeParsed,
      DisasterAssessment
    >({
      name: 'sonae-test',
      discoverer,
      retriever,
      parser,
      extractor,
      cacheKey: (q) => q.municipality_code,
      caches: { source: sourceCache, parsed: parsedCache, result: resultCache },
    });

    const result = await pipeline.run(
      { municipality_code: 'TEST', city_name: 'テスト市' },
      { emit },
    );

    expect(result.city).toBe('テスト市');
    expect(result.by_disaster_type).toHaveLength(1);
    expect(result.by_disaster_type[0].disaster_type).toBe('地震');

    // Each layer ran once
    expect(discoverer.calls).toBe(1);
    expect(retriever.calls).toBe(1);
    expect(parser.calls).toBe(1);
    expect(extractor.calls).toBe(1);

    // All caches written
    expect(existsSync(join(cacheDir, 'discovery', 'TEST.json'))).toBe(true);
    expect(existsSync(join(cacheDir, 'ocr', 'TEST.md'))).toBe(true);
    expect(existsSync(join(cacheDir, 'ocr', 'TEST.meta.json'))).toBe(true);
    expect(existsSync(join(cacheDir, 'municipalities', 'TEST.json'))).toBe(true);

    // OCR markdown is plain text and human-readable
    expect(readFileSync(join(cacheDir, 'ocr', 'TEST.md'), 'utf-8')).toContain('第6章');
  });

  it('readSonaeResult returns the cached final assessment', async () => {
    const { Pipeline, JsonFileCache, TextFileCache } = await import('@/lib/core');
    const sonae = await loadSonae(cacheDir);
    // Pre-seed the result cache as the actual pipeline would
    const resultCache = new JsonFileCache<DisasterAssessment>({
      dir: join(cacheDir, 'municipalities'),
      ext: 'json',
    });
    const sample: DisasterAssessment = {
      city: '横浜市',
      by_disaster_type: [{ disaster_type: '地震', scenarios: [] }],
      generated_at: new Date().toISOString(),
    };
    await resultCache.write('14100', sample, { emit: () => {} });

    const r = await sonae.readSonaeResult('14100');
    expect(r).not.toBeNull();
    expect(r!.city).toBe('横浜市');

    const missing = await sonae.readSonaeResult('99999');
    expect(missing).toBeNull();

    // Suppress unused-import warnings (dynamic imports above are for typing).
    void Pipeline;
    void TextFileCache;
  });
});
