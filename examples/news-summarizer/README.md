# news-summarizer — Sonae framework example

A minimal pipeline built on the Sonae core framework. Demonstrates that the
same `Pipeline` class that powers Sonae's disaster-plan extraction can wrap an
entirely different domain — here, summarising any HTML article URL.

## What it does

```
URL → Discover (verify URL) → Retrieve (HTTP GET) → Parse (HTML → text) → Extract (LLM → bullet summary)
```

No PDFs, no OCR, no browser automation. Just `fetch` + a tiny HTML stripper +
one LLM call with a Zod schema.

## Files

- [`pipeline.ts`](./pipeline.ts) — the full configured pipeline (~120 lines)
- [`run.ts`](./run.ts) — CLI entrypoint: `npx tsx examples/news-summarizer/run.ts <url>`

## Why look at this

It's the **smallest possible working pipeline** built on the framework.
Read this first before extending Sonae for your own domain — see
[`docs/EXTENDING.md`](../../docs/EXTENDING.md) for the full guide.

## Running

```bash
# from the repo root
npm install
# point at your OpenAI-compatible LLM:
export LLM_BASE_URL=http://localhost:1234/v1
export LLM_MODEL=gemma-4-e4b-it@q4_k_s
export LLM_API_KEY=not-needed

npx tsx examples/news-summarizer/run.ts https://en.wikipedia.org/wiki/Pre-disaster_recovery
```

Output:

```
[discovery] discover: https://en.wikipedia.org/wiki/Pre-disaster_recovery
[retrieval] HTTP 200, 145.2 KB
[parsing] stripped to 12834 chars
[extracting] llm summary
[result]
{
  "title": "Pre-disaster recovery",
  "summary": "...",
  "key_points": ["...", "..."]
}
```

Re-run with the same URL: result cache hit, returns instantly.
