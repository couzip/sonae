# Sonae

> **Pre-disaster preparedness, in a cockpit.**
> *While other apps respond to disasters, Sonae prepares you for them.*
>
> 災害が起きる前に動く防災コックピット — and an OSS reference implementation
> for using lightweight LLMs to consolidate scattered public information.

---

## Two things in one repo

### 1. The Sonae app

A Next.js + TypeScript app that resolves a Japanese municipality, downloads
its official **regional disaster plan PDF**, runs OCR on the "想定被害"
(expected damage) section with a small Vision LLM, then has Gemma 4 produce
**individually-tailored countermeasure recommendations** based on the user's
building age, household composition, and location features.

The advice is framed by the principle **「攻撃 − 防御 = 生存率」** (attack −
defense = survival rate): pre-event physical hardening (seismic retrofit,
furniture securing, breakers) is Tier 1; pre-event preparation (evacuation
plans, contact methods) is Tier 2; post-event coping (water/food stockpile)
is Tier 3. The LLM is instructed to weight Tier 1 highest.

Privacy first: the user profile lives in `localStorage` and is sent to the
LLM only as input to the recommendation call.

### 2. The framework underneath

The same code is a reference implementation for a **general pattern**:
lightweight LLMs + structured extraction + scattered public sources.

```
            query                     structured result
              │                              ▲
              ▼                              │
     ┌──────────────────────────────────────────────────┐
     │                Pipeline (core)                   │
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

The four interfaces in [`src/lib/core/types.ts`](src/lib/core/types.ts) are
the entire public contract. Anything that satisfies them is a valid pipeline.
See [`docs/EXTENDING.md`](docs/EXTENDING.md) and
[`examples/news-summarizer/`](examples/news-summarizer/) for how to apply
this to medical PDFs, legal texts, educational curriculum, or anywhere else
you need a small LLM to consolidate fragmented public data.

---

## Repository layout

```
src/
├── lib/
│   ├── core/                 # Framework (domain-agnostic, OSS-reusable)
│   │   ├── Pipeline.ts          generic pipeline runner with cache layers
│   │   ├── types.ts             Discoverer / Retriever / Parser / Extractor / Cache / Freshness
│   │   ├── llm.ts               OpenAI-compatible client (chatJson + chatVision)
│   │   ├── pdf.ts               pdfjs-dist wrappers (text extract + render via @napi-rs/canvas)
│   │   ├── fileCache.ts         JsonFileCache / TextFileCache / BinaryFileCache / PathHandleCache
│   │   ├── httpFreshness.ts     HEAD-based freshness checker
│   │   ├── repairJson.ts        truncated-JSON recovery
│   │   ├── events.ts            ProgressEvent + EmitFn
│   │   └── index.ts
│   │
│   ├── sonae/                # Disaster domain (reference implementation)
│   │   ├── discoverer.ts        municipality registry + Playwright Discovery
│   │   ├── retriever.ts         PDF download with HTTP headers captured
│   │   ├── parser.ts            TOC → LLM section pick → keyword scan → partial OCR
│   │   ├── extractor.ts         map-reduce: enum disaster types → per-type scenarios
│   │   ├── pipeline.ts          configured Pipeline + cache wiring
│   │   ├── countermeasures.ts   YAML loader for the 74-item countermeasure master
│   │   ├── municipality.ts      municipalities.yaml registry
│   │   ├── nextActions.ts       LLM call for strategic insights + priority actions
│   │   ├── schemas.ts           Zod + JSON schemas for all sonae outputs
│   │   ├── types.ts
│   │   └── index.ts
│   │
│   ├── countermeasures-filter.ts   client-safe filter (no node imports)
│   ├── disaster-mapping.ts         JP name ↔ enum
│   ├── geocode.ts                  GSI reverse geocode
│   ├── treemap/squarify.ts         d3-hierarchy adapter
│   └── utils.ts
│
├── components/               # UI (cockpit aesthetic)
├── stores/                   # Zustand
└── app/                      # Next.js App Router (5 screens + 4 API routes)

data/
├── countermeasures.yaml      # 74 防災対策 master
└── municipalities.yaml       # registry

docs/
└── EXTENDING.md              # how to fork the framework for a new domain

examples/
└── news-summarizer/          # minimal pipeline (HTTP + HTML + LLM, no PDF/OCR)
```

---

## Cache architecture

Five tiers, content-based invalidation (no time TTL):

| Tier | Path | Skipped if hit | Notes |
|---|---|---|---|
| 1. Result | `cache/municipalities/{code}.json` | Everything | ~10 ms re-run |
| 2. Parsed | `cache/ocr/{code}.{md,meta.json}` | Discovery / Retrieval / Parser | OCR markdown is preserved long-term (RAG-ready) |
| 3. Source | `cache/discovery/{code}.json` | Discovery only | The picked PDF target |
| 4. Blob | `cache/pdfs/{code}.pdf` + `.meta.json` + `.http.json` | Retrieval only | HEAD-checked before reuse |
| 5. Work | `cache/work/{code}_{ts}/` | (debug only) | toc.md, page PNGs, ocr_combined.md |

Source freshness is checked with an HTTP HEAD on the PDF URL (`Last-Modified`
/ `ETag` / `Content-Length`). On `'stale'` verdict the parsed/result tiers
are invalidated cascade-style.

Query parameters:

- `?force=1` — bypass all caches (full re-run)
- `?force_ocr=1` — bypass parsed + result, keep upstream

---

## Quick start

### Prerequisites

- Node.js 20+ (also tested on 22.x via CI)
- An OpenAI-compatible LLM endpoint with these models loaded:
  - **LLM**: `gemma-4-e4b-it@q4_k_s` (Gemma 4 4B, Q4_K_S quantization)
  - **Vision/OCR**: `enginil/dots.mocr` (or compatible alternative)

LM Studio defaults work out of the box on `http://localhost:1234/v1`.

### Install and run

```bash
git clone <repo>
cd app
npm install                       # postinstall fetches Playwright Chromium
cp .env.example .env              # tune endpoints if needed

npm run dev                       # http://localhost:3000
```

### Required dev commands

```bash
npm run typecheck     # tsc --noEmit
npm run lint          # next lint
npm run format:check  # prettier --check
npm run test          # vitest run
```

CI runs all four on Node 20.x and 22.x.

---

## Environment variables

```env
# LLM (structured extraction + recommendations)
LLM_BASE_URL=http://localhost:1234/v1
LLM_API_KEY=not-needed
LLM_MODEL=gemma-4-e4b-it@q4_k_s

# Vision/OCR (image → markdown)
OCR_BASE_URL=http://localhost:1234/v1
OCR_API_KEY=not-needed
OCR_MODEL=enginil/dots.mocr

# Discovery (Playwright + 実 Chrome) を visible で起動。
# headless だと Google が reCAPTCHA を返して失敗するため visible 推奨。
BROWSER_USE_HEADLESS=false

# Cache root override (default: ./cache)
SONAE_CACHE_DIR=
```

---

## API routes

| Path | Method | Purpose |
|---|---|---|
| `/api/lookup` | POST | address / coordinates → municipality code |
| `/api/disasters` | GET | run pipeline, stream SSE progress events |
| `/api/checklist` | GET | filter the 74-item countermeasure master by detected disasters |
| `/api/next-actions` | POST | profile + checklist state → strategic insights + priority actions |

---

## Adding a municipality

`data/municipalities.yaml` is hand-curated. To add a city:

```yaml
- code: '<5-digit JIS code>'
  name: <Japanese name>
  prefecture: <prefecture name>
  prefecture_code: '<2-digit>'
  lat: <lat>
  lng: <lng>
  name_aliases: [<alternate spellings for fuzzy match>]
  disaster_plan_url: <direct PDF URL — preferred over Discovery>
  disaster_plan_label: <human label>
  disaster_plan_page_url: <citing source page>
```

`disaster_plan_url` short-circuits the Playwright Discovery layer. Use it
whenever you have a stable URL — faster, deterministic, no Google ToS issues.

---

## Design principles

### Pre-event defense over post-event response

The advice LLM is prompted with **「攻撃 − 防御 = 生存率」**:

- **Tier 1 (defense)**: physical hardening — seismic retrofit, furniture
  securing, seismic breakers, water-stop boards, roof lightening
- **Tier 2 (preparation)**: hazard map awareness, evacuation triggers,
  family contact, warning subscriptions
- **Tier 3 (post-event coping)**: water / food / portable toilet stockpile

Tier 1 has the highest leverage: stockpile won't help if the building
collapsed in the first 30 seconds. The prompt enforces at least one Tier 1
strategic insight per recommendation.

### No numerical scores

No "preparedness rating", no percentage, no points. Numbers invite
gamification and misread as "I'm safe enough". Sonae shows facts (with
sources) and lets the user judge.

### Privacy by default

Profile data is `localStorage` only. The only time profile crosses to the
server is during `/api/next-actions` — and that endpoint exists exactly to
let the LLM consider the user's context.

### Source attribution everywhere

Every datum the user sees in the cockpit has a citation chip linking to the
official PDF (`source.pdf_url`) and the page that linked it (`source.page_url`).

---

## Hackathon submission notes

Built for [The Gemma 4 Good Hackathon](https://www.kaggle.com/competitions/gemma-4-good-hackathon)
(Kaggle × Google DeepMind, 2026).

This is a working prototype, not a production system. **In an actual
emergency, follow JMA / municipal authoritative information.**

### Known compliance debts

- **Discovery fallback uses Google Search**: when a municipality has no
  `disaster_plan_url` registry entry, the pipeline opens `google.com/search`
  via Playwright + the system Chrome (rebrowser-playwright で bot 検出を
  回避)。 This violates Google's ToS for programmatic access. Demo-target
  cities (Yokohama 14100, Kawasaki 14130, …) all have registry entries, so
  the fallback never fires for them. **Replacement plan**: Brave Search API
  or per-prefecture sitemap crawl.

- **Model dependencies**: defaults are pinned to `gemma-4-e4b-it@q4_k_s`
  (LLM) and `enginil/dots.mocr` (OCR). Other OpenAI-compatible models work
  but Zod-strict output quality varies. Document any swap clearly.

---

## License

MIT — see [LICENSE](LICENSE).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). The framework parts in `src/lib/core/`
are intended to be domain-agnostic; please don't add disaster-specific logic
there. Domain code lives in `src/lib/sonae/`.

## Credits

- 国土地理院 (Geospatial Information Authority of Japan) — map tiles, geocoder
- Mozilla pdf.js — PDF parsing
- @napi-rs/canvas — Node.js canvas
- LM Studio — local model serving
