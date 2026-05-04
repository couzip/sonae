# Extending Sonae for a new domain

Sonae is a working pre-disaster preparedness app for Japan, **and** an OSS
reference implementation for a general pattern: **using lightweight LLMs to
consolidate scattered, fragmented public information into structured form**.

This guide explains how to fork the framework parts and apply them to a
different domain (medical drug labels, regulatory texts, educational
curriculum, government grant applications, etc.).

---

## The pattern

```
            query                     structured result
              │                              ▲
              ▼                              │
     ┌──────────────────────────────────────────────────┐
     │                Pipeline (core)                   │
     │                                                  │
     │   Discover ── Retrieve ── Parse ── Extract       │
     │      │           │           │          │       │
     │   ┌──┴──┐    ┌──┴──┐    ┌──┴──┐   ┌──┴──┐     │
     │   │cache│    │cache│    │cache│   │cache│     │
     │   └─────┘    └─────┘    └─────┘   └─────┘     │
     └──────────────────────────────────────────────────┘
                                                 ▲
                                          freshness check
                                       (HTTP HEAD / etag / ...)
```

Each layer is an interface with a single method. You implement the four
interfaces for your domain, plug them into `Pipeline`, and you get free:

- Five-tier caching (final result / parsed / source / blob)
- HTTP HEAD-based freshness (or any custom freshness check)
- SSE-style progress events streamed to clients
- JSON repair for truncated LLM output
- Map-reduce extraction patterns (via the LLM client)

---

## Step-by-step: build a new pipeline

We'll implement a tiny **regulation summariser**: query a regulation ID, fetch
the gov.uk page, summarise key provisions with an LLM. ~50 lines of glue code.

### 1. Define your domain types

```ts
// src/lib/regulation/types.ts
export interface RegQuery   { id: string }
export interface RegSource  { url: string; title: string }
export interface RegBlob    { html: string; etag?: string }
export interface RegParsed  { plain_text: string; section_count: number }
export interface RegResult  {
  id: string;
  summary: string;
  key_provisions: { title: string; text: string }[];
}
```

### 2. Implement the four layers

```ts
// src/lib/regulation/discoverer.ts
import type { Discoverer } from '@/lib/core';
import type { RegQuery, RegSource } from './types';

export class GovUkDiscoverer implements Discoverer<RegQuery, RegSource> {
  async discover(q: RegQuery) {
    return {
      url: `https://www.legislation.gov.uk/uksi/${q.id}/contents`,
      title: q.id,
    };
  }
}
```

```ts
// src/lib/regulation/retriever.ts
import type { Retriever, PipelineContext } from '@/lib/core';

export class HttpRetriever implements Retriever<RegSource, RegBlob> {
  async retrieve(src, ctx: PipelineContext) {
    const r = await fetch(src.url, { signal: ctx.signal });
    return { html: await r.text(), etag: r.headers.get('etag') ?? undefined };
  }
}
```

```ts
// src/lib/regulation/parser.ts
import type { Parser } from '@/lib/core';

export class HtmlToTextParser implements Parser<RegBlob, RegParsed> {
  async parse(blob) {
    const plain_text = blob.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const section_count = (blob.html.match(/<h2/g) || []).length;
    return { plain_text, section_count };
  }
}
```

```ts
// src/lib/regulation/extractor.ts
import { type Extractor, type LlmClient } from '@/lib/core';

const SCHEMA = {
  type: 'json_schema',
  json_schema: {
    name: 'RegSummary',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        summary: { type: 'string' },
        key_provisions: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: { title: { type: 'string' }, text: { type: 'string' } },
            required: ['title', 'text'],
          },
        },
      },
      required: ['summary', 'key_provisions'],
    },
  },
};

export class LlmRegSummariser implements Extractor<RegParsed, RegResult> {
  constructor(private llm: LlmClient, private id: () => string) {}
  async extract(parsed) {
    const out = await this.llm.chatJson<{ summary: string; key_provisions: any[] }>({
      prompt: `Summarise the regulation. 3-7 key provisions.\n\n${parsed.plain_text.slice(0, 30_000)}`,
      responseFormat: SCHEMA,
      maxTokens: 2048,
    });
    return { id: this.id(), ...out };
  }
}
```

### 3. Wire it up

```ts
// src/lib/regulation/pipeline.ts
import {
  Pipeline,
  JsonFileCache,
  TextFileCache,
  createLlmClient,
  createHttpFreshness,
} from '@/lib/core';

const llm = createLlmClient({
  baseURL: process.env.LLM_BASE_URL!,
  apiKey: process.env.LLM_API_KEY ?? 'not-needed',
  model: process.env.LLM_MODEL ?? 'gemma-4-e4b-it@q4_k_s',
});

let currentId = '';

const pipeline = new Pipeline({
  name: 'regulation-summariser',
  discoverer: new GovUkDiscoverer(),
  retriever: new HttpRetriever(),
  parser: new HtmlToTextParser(),
  extractor: new LlmRegSummariser(llm, () => currentId),
  cacheKey: (q) => q.id,
  caches: {
    source: new JsonFileCache({ dir: 'cache/reg/sources', ext: 'json' }),
    parsed: new JsonFileCache({ dir: 'cache/reg/parsed', ext: 'json' }),
    result: new JsonFileCache({ dir: 'cache/reg/results', ext: 'json' }),
  },
});

export async function summariseRegulation(id: string, emit) {
  currentId = id;
  return await pipeline.run({ id }, { emit });
}
```

That's the whole pipeline. ~150 lines including imports, comments, and the
JSON schema. Caching, progress events, and the run loop are inherited.

### 4. (Optional) Add an SSE route

```ts
// src/app/api/regulation/route.ts
import type { ProgressEvent } from '@/lib/core';
import { summariseRegulation } from '@/lib/regulation/pipeline';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return new Response('id required', { status: 400 });

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const emit = (e: ProgressEvent) =>
        controller.enqueue(enc.encode(`event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`));
      try {
        await summariseRegulation(id, emit);
      } catch (err: any) {
        emit({ type: 'error', message: String(err?.message ?? err) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
  });
}
```

Done. Hitting `/api/regulation?id=2024/123` runs the pipeline, streams progress
events, caches everything, and returns a structured summary.

---

## Patterns for harder cases

### TOC-driven partial OCR (large PDFs)

Sonae's `SonaeTocOcrParser` (`src/lib/sonae/parser.ts`) demonstrates the
pattern: parse the document's table of contents with the LLM, identify the
target section, search the text layer for the heading, then OCR only the
relevant pages. This keeps small models tractable on 200+ page PDFs.

Reuse: copy `parser.ts`, replace `'被害想定'` with your section keyword,
adjust the TOC prompt for your language, and you have a partial-OCR parser
for any structured PDF domain.

### Map-reduce structured extraction

`SonaeMapReduceExtractor` (`src/lib/sonae/extractor.ts`) shows the two-step
pattern that lets a 4B model handle long documents:

1. **Step A**: extract the categorical enum (which disaster types appear?).
2. **Step B**: for each enum value, run an isolated extraction call.

Use this when:
- The document covers many independent topics
- A monolithic prompt blows your context window
- You need parallelism per topic

### Graceful freshness without ETag support

Many public sites don't return `Last-Modified` or `ETag`. The framework's
freshness API returns `'unknown'` in that case, which means **trust the cache
unless explicitly forced**. To detect content changes you can:

- Periodically run with `force: true` (cron / GitHub Actions)
- Hash the bytes after retrieval and compare to the cached hash
- Implement a custom `Freshness<TSource, TBlobMeta>` that does both

### Multiple discoverers / fallback

Sonae uses a static `data/municipalities.yaml` registry and falls back to
browser-use only when the registry has no entry. To implement N-tier
discovery, write a composite Discoverer:

```ts
class CompositeDiscoverer<Q, S> implements Discoverer<Q, S> {
  constructor(private layers: Discoverer<Q, S | null>[]) {}
  async discover(q, ctx) {
    for (const layer of this.layers) {
      const r = await layer.discover(q, ctx);
      if (r) return r;
    }
    throw new Error('no discoverer matched');
  }
}
```

---

## File layout for your fork

```
src/lib/
├── core/                  # framework — do not modify
│   ├── Pipeline.ts
│   ├── types.ts
│   ├── llm.ts
│   ├── pdf.ts
│   ├── fileCache.ts
│   ├── httpFreshness.ts
│   ├── repairJson.ts
│   ├── events.ts
│   └── index.ts
│
├── <your-domain>/         # what you write
│   ├── types.ts
│   ├── schemas.ts         # Zod + JSON schema for your TResult
│   ├── discoverer.ts
│   ├── retriever.ts
│   ├── parser.ts
│   ├── extractor.ts
│   ├── pipeline.ts        # configures Pipeline with your layers
│   └── index.ts           # public API
│
└── sonae/                 # reference impl (delete or keep as example)
```

The contract is the four interfaces in `core/types.ts`. Anything that satisfies
them is a valid Sonae pipeline.

---

## See also

- [`examples/news-summarizer/`](../examples/news-summarizer/) — minimal working
  pipeline (HTTP fetch + HTML parse + LLM summarise) without OCR or browser
  automation. Good first read.
- [`src/lib/sonae/`](../src/lib/sonae) — full reference implementation with
  TOC-driven OCR, map-reduce extraction, browser-use Discovery fallback.
