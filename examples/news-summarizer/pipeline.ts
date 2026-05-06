/**
 * Minimal pipeline example: summarise an HTML article URL.
 *
 * Demonstrates the Sonae core framework with a domain that has no PDFs, no
 * OCR, and no browser automation. The full pipeline is ~120 lines.
 */

import { join, resolve } from 'node:path';
import { z } from 'zod';
import {
  JsonFileCache,
  Pipeline,
  createLlmClient,
  type Discoverer,
  type Extractor,
  type LlmClient,
  type Parser,
  type Retriever,
} from '@/lib/core';

// =============================================================================
// 1. Domain types
// =============================================================================
export interface NewsQuery {
  url: string;
}
export interface NewsSource {
  url: string;
}
export interface NewsBlob {
  html: string;
  status: number;
  bytes: number;
}
export interface NewsParsed {
  text: string;
  title: string;
}
export interface NewsResult {
  title: string;
  summary: string;
  key_points: string[];
  source_url: string;
}

// =============================================================================
// 2. Layers
// =============================================================================
class IdentityDiscoverer implements Discoverer<NewsQuery, NewsSource> {
  async discover(q: NewsQuery): Promise<NewsSource> {
    if (!/^https?:\/\//i.test(q.url)) throw new Error('expected http(s) URL');
    return { url: q.url };
  }
}

class HttpHtmlRetriever implements Retriever<NewsSource, NewsBlob> {
  async retrieve(src: NewsSource): Promise<NewsBlob> {
    const r = await fetch(src.url, {
      headers: { 'User-Agent': 'sonae-example/1.0' },
      redirect: 'follow',
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const html = await r.text();
    return { html, status: r.status, bytes: html.length };
  }
}

class HtmlPlainTextParser implements Parser<NewsBlob, NewsParsed> {
  async parse(blob: NewsBlob): Promise<NewsParsed> {
    const titleMatch = blob.html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : '';
    const text = blob.html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim();
    return { title, text };
  }
}

const SummarySchema = z.object({
  title: z.string().describe('Refined article title'),
  summary: z.string().describe('2-3 sentence neutral summary'),
  key_points: z.array(z.string()).describe('3-7 bullet-style key takeaways'),
});

class LlmNewsSummariser implements Extractor<NewsParsed, NewsResult> {
  constructor(
    private readonly llm: LlmClient,
    private readonly currentUrl: () => string,
  ) {}

  async extract(parsed: NewsParsed): Promise<NewsResult> {
    const out = await this.llm.chatJson({
      prompt: `Summarise the following article in neutral prose.
3-7 short bullet "key_points". Refine the title if needed.

--- TITLE ---
${parsed.title}
--- BODY (truncated to 30000 chars) ---
${parsed.text.slice(0, 30_000)}`,
      schema: SummarySchema,
      schemaName: 'NewsSummary',
      maxTokens: 1024,
    });
    return { ...out, source_url: this.currentUrl() };
  }
}

// =============================================================================
// 3. Configured pipeline
// =============================================================================
const cacheDir = resolve(process.env.NEWS_CACHE_DIR ?? join(process.cwd(), 'cache', 'news'));

const llm = createLlmClient({
  baseURL: process.env.LLM_BASE_URL ?? 'http://localhost:1234/v1',
  apiKey: process.env.LLM_API_KEY ?? 'not-needed',
  model: process.env.LLM_MODEL ?? 'gemma-4-e4b-it@q4_k_s',
});

let _currentUrl = '';

const cacheKeyOf = (q: NewsQuery): string =>
  // Filesystem-safe hash-ish key. For real use, prefer createHash('sha1').
  q.url.replace(/[^a-zA-Z0-9-]+/g, '_').slice(0, 120);

export const newsPipeline = new Pipeline<
  NewsQuery,
  NewsSource,
  NewsBlob,
  unknown,
  NewsParsed,
  NewsResult
>({
  name: 'news-summarizer',
  discoverer: new IdentityDiscoverer(),
  retriever: new HttpHtmlRetriever(),
  parser: new HtmlPlainTextParser(),
  extractor: new LlmNewsSummariser(llm, () => _currentUrl),
  cacheKey: cacheKeyOf,
  caches: {
    parsed: new JsonFileCache<NewsParsed>({ dir: join(cacheDir, 'parsed'), ext: 'json' }),
    result: new JsonFileCache<NewsResult>({ dir: join(cacheDir, 'results'), ext: 'json' }),
  },
});

export async function summariseNews(
  url: string,
  emit: (e: { type: string; [k: string]: unknown }) => void,
): Promise<NewsResult> {
  _currentUrl = url;
  return await newsPipeline.run({ url }, { emit: emit as any });
}
