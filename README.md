# Sonae — Gemma 4 Good Hackathon Submission

> **Pre-disaster preparedness, in a cockpit.**
> *While other apps respond to disasters, Sonae prepares you for them.*

---

## Overview

Sonae is a submission to **The Gemma 4 Good Hackathon**
(Kaggle × Google DeepMind, 2026) in the **Global Resilience** track.

It is a Next.js + TypeScript app that resolves a Japanese municipality from
a GPS coordinate, address, or map click, downloads that city's official
*regional disaster plan* PDF, runs OCR on the expected-damage section with a
multimodal small LLM, and has Gemma 4 produce **individually-tailored
countermeasure recommendations** based on the user's building age, household
composition, and location.

| Item | Value |
|---|---|
| Track | Global Resilience |
| Hackathon | [Kaggle: The Gemma 4 Good Hackathon](https://www.kaggle.com/competitions/gemma-4-good-hackathon) |
| Submission deadline | May 18, 2026 |
| Models used | Gemma 4 4B (q4_k_s, local) + Gemma 4 26B-A4B (OpenRouter) + dots.mocr (vision OCR) |
| Repository | this repo |
| License | MIT |

---

## The Challenge

Japan has **1,741 municipalities**, each publishing its own *regional disaster
plan* as a 100–500 page PDF on its own website. Every plan contains an
**expected-damage** chapter that lists, for that exact location: the design
earthquake, the maximum tsunami / flood depth, the assumed wind speed,
expected casualty counts, expected building collapses.

This is the most rigorous, location-specific risk information a resident can
access. It is also functionally invisible: long PDFs, scattered URLs, no
search index, table-of-contents structure that varies between cities, and
many of them scanned-image PDFs with no text layer.

Residents end up relying on generic "have a 3-day stockpile" advice that
ignores their building's age, their family composition, and the actual
hazards their city faces. Stockpile alone won't help if the building
collapses in the first 30 seconds — and the local plan often says so
explicitly, in a chapter nobody reads.

This problem fits the **Global Resilience** track: bridging the gap between
authoritative public risk information and what residents can practically
use, in a country where the next earthquake or typhoon is not hypothetical.

---

## Our Solution

Sonae extracts each city's expected-damage section, normalizes it into a
structured assessment, and lets Gemma 4 produce per-resident priority
actions weighted by a three-tier defense model:

- **Tier 1 (defense)**: physical hardening — seismic retrofit, furniture
  securing, seismic breakers, water-stop boards, roof lightening
- **Tier 2 (preparation)**: hazard map awareness, evacuation triggers,
  family contact, warning subscriptions
- **Tier 3 (post-event coping)**: water / food / portable toilet stockpile

Tier 1 has the largest leverage on survival, and the prompt enforces at
least one Tier 1 strategic insight per recommendation.

### Key Features

- **One-tap municipality resolution** — GPS, address, or map click; designated-city wards (~150 wards across 20 cities) resolve to their parent city automatically
- **Live PDF discovery and download** — Playwright-driven discovery for un-registered cities; direct URL short-circuit for the registered ones
- **Multimodal OCR fallback** — scanned-image PDFs without a text layer are rendered to PNG and OCR'd page-by-page via a vision model
- **Structured-output pipeline** — every LLM call is constrained by a JSON Schema (Zod-validated); no free-form parsing anywhere in the data path
- **Map-reduce extraction** — Step A enumerates which of 23 disaster types the municipality faces; Step B extracts scenarios per type in parallel
- **Five cache tiers with content-based invalidation** — re-runs are ~10 ms when the upstream PDF hasn't changed
- **Source attribution** — every datum the user sees is linked to the official PDF page that produced it
- **Privacy-first** — user profile lives in `localStorage`; only the recommendation call sees it
- **No numerical scores** — Sonae shows facts, not a "preparedness rating"; numbers misread as "I'm safe enough"
- **Admin panel** — `/admin` for operators to extend the registry, inspect cache, and run the full-page-OCR fallback path

---

## How We Used Gemma 4

Gemma 4 sits on three axes of the pipeline.

### 1. Multimodal vision OCR

Many municipal PDFs are scanned images with no text layer. The pipeline
detects this in `parser.ts` and falls back to a vision pass: each page is
rendered to PNG, sent to a vision model with an OCR prompt, and the resulting
markdown is treated as the document body. The reference deployment uses
`enginil/dots.mocr` for OCR via an OpenAI-compatible vision endpoint —
Gemma 4's multimodal capability lets the same model family cover this step
in deployments that prefer a single model.

### 2. Structured output via JSON Schema

Every LLM call in the pipeline is constrained by a JSON Schema
(`src/lib/sonae/schemas.ts`, Zod-validated). Gemma 4's structured-output
support is what lets a 4B-parameter local model reliably drive a production
pipeline:

- **Discovery**: pick the correct disaster-plan PDF from a list of candidate links (1 call)
- **TOC selection**: pick the expected-damage chapter from the parsed table of contents (1 call)
- **Step A (map)**: enumerate which of 23 disaster types this municipality faces (1 call)
- **Step B (reduce)**: per disaster type, extract scenarios with name / scale / expected damage / source page (N parallel calls)
- **Next actions**: generate priority actions with reasoning, urgency, and effort summary (1 call)

### 3. Role-based model routing

A single resolver (`src/lib/sonae/llmRoles.ts`) picks a model per role:
`main`, `discovery`, `toc`, `step_a`, `next_actions`, `ocr`. Each role falls
back to the main model if not overridden. The reference setup pairs a local
Gemma 4 4B (LM Studio, fast and free) for the bulk of calls with a larger
Gemma 4 26B-A4B (via OpenRouter / LiteLLM proxy) for the precision-critical
TOC selection and Step A enumeration. Anyone can swap any role to any
OpenAI-compatible endpoint via a single env-var triple — no code change.

---

## Tech Stack

| Layer | Stack |
|---|---|
| LLM | Gemma 4 4B (LM Studio) for hot path · Gemma 4 26B-A4B (OpenRouter / LiteLLM) for precision tasks |
| Vision OCR | dots.mocr (or any OpenAI-compatible vision endpoint) |
| Frontend | Next.js 15 (App Router) · TypeScript · Tailwind · Zustand |
| Mapping | MapLibre GL JS · GSI (Geospatial Information Authority of Japan) tiles |
| Pipeline | Custom 4-stage Pipeline (Discoverer / Retriever / Parser / Extractor) with 5 cache tiers |
| PDF | pdfjs-dist · @napi-rs/canvas |
| Discovery | rebrowser-playwright + system Chrome |
| Schemas | Zod · OpenAI-compatible JSON Schema |
| Reporting | html2canvas + jsPDF (per-resident PDF report) |
| Tests | Vitest (154+ tests across 24 files) · Prettier · ESLint · tsc strict |

### Architecture

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
the entire public contract. The Sonae app is a reference implementation; the
framework is reusable for medical PDFs, legal texts, educational curriculum,
or anywhere else a small LLM needs to consolidate fragmented public sources.
See [`docs/EXTENDING.md`](docs/EXTENDING.md) and
[`examples/news-summarizer/`](examples/news-summarizer/).

#### Cache tiers

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

Query parameters: `?force=1` (bypass all caches), `?force_ocr=1` (bypass
parsed + result, keep upstream).

---

## Quick Start

### Prerequisites

- Node.js 20+ (also tested on 22.x via CI)
- An OpenAI-compatible LLM endpoint with these models loaded:
  - **LLM**: `gemma-4-e4b-it@q4_k_s` (Gemma 4 4B, Q4_K_S quantization)
  - **Vision/OCR**: `enginil/dots.mocr` (or compatible alternative)

LM Studio defaults work out of the box on `http://localhost:1234/v1`. For
the precision-critical TOC and Step A roles, point them at any
OpenAI-compatible endpoint serving Gemma 4 26B-A4B (e.g. OpenRouter via
LiteLLM proxy).

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

CI runs all four on Node 20.x and 22.x. See `.env.example` for the full
list of environment variables (per-role LLM overrides, OCR endpoint, admin
panel credentials, cache root).

---

## Demo & Screenshots

> **Live demo**: _linked at submission_
> **Video walkthrough (90 s)**: _linked at submission_
> **Kaggle writeup notebook**: _linked at submission_

Demo flow:

1. Pick a location — GPS, address autocomplete, or map click
2. Watch the pipeline stream progress (Discovery → Retrieval → TOC → OCR → Extract) over Server-Sent Events
3. Review the disaster grid (treemap of detected disaster types, scaled by severity)
4. Drill into any disaster type to see scenarios and source-page citations
5. Fill in building / household / lifestyle profile (stays in `localStorage`)
6. Get individually-tailored priority actions with reasoning
7. Export a per-resident PDF report

---

## Impact & Evaluation

### Why this matters

Sonae targets the gap between the rigorous risk information Japanese
municipalities already publish and what residents can practically use.

- **1,741 municipalities** in Japan, each with its own disaster-plan PDF —
  Sonae's pipeline scales to all of them, with per-city caching and
  content-based invalidation
- **Wards of designated cities** (20 cities, ~150 wards) resolve to their
  parent city automatically (`data/seirei_wards.json`), so a resident
  searching for any ward reaches the parent city's plan with no manual
  lookup
- **Tier-1 first**: by enforcing physical-hardening recommendations as the
  primary output, Sonae moves residents up the survival curve before the
  event, where the leverage on outcomes is largest

### Alignment with judging criteria

| Criterion | How Sonae addresses it |
|---|---|
| **Impact & Vision** | Targets a well-defined survivor population (residents in 1,741 Japanese municipalities) with a measurable shift: from generic "stockpile" advice to per-resident Tier-1 hardening actions grounded in their city's own published risk |
| **Video Pitch & Storytelling** | The cockpit UI is built to show the journey from coordinate → official PDF → expected-damage chapter → tailored action in under 90 seconds end-to-end |
| **Technical Depth & Execution** | Reference-implementation framework with clean interface boundaries (`lib/core/` vs `lib/sonae/`), 154+ tests across 24 files, role-based LLM routing, 5-tier cache, multimodal OCR fallback, structured output via JSON Schema, full TypeScript strict mode, no `any` types, CI on Node 20.x + 22.x |

### Limitations

- **Discovery for un-registered cities**: when a municipality is missing from `municipalities.yaml` and has no direct `disaster_plan_url`, the pipeline falls back to a Playwright-driven Google search to locate the PDF. This works but is not a long-term solution; per-prefecture sitemap crawling or a paid search API is the upgrade path. Cities with a registry entry never hit this fallback.
- **Model dependencies**: the reference deployment is pinned to `gemma-4-e4b-it@q4_k_s` and `enginil/dots.mocr`. Other OpenAI-compatible models work but may need prompt tuning for strict JSON Schema output.
- **Prototype, not production**: this is a working prototype. **In an actual emergency, follow JMA / municipal authoritative information.**

---

## Repository Structure

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
│   │   ├── llmRoles.ts          role-based LLM resolver
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
└── app/                      # Next.js App Router (5 screens + 4 API routes + admin)

data/
├── countermeasures.yaml         # 74-item countermeasure master
├── municipalities.yaml          # registry
└── seirei_wards.json            # JIS X 0402 ward → parent city map (designated cities)

docs/
└── EXTENDING.md                 # how to fork the framework for a new domain

examples/
└── news-summarizer/             # minimal pipeline (HTTP + HTML + LLM, no PDF/OCR)
```

### API routes

| Path | Method | Purpose |
|---|---|---|
| `/api/lookup` | POST | address / coordinates → municipality code |
| `/api/disasters` | GET | run pipeline, stream SSE progress events |
| `/api/checklist` | GET | filter the 74-item countermeasure master by detected disasters |
| `/api/next-actions` | POST | profile + checklist state → strategic insights + priority actions |
| `/api/admin/*` | various | admin panel (auth-gated) |

### Adding a municipality

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
whenever you have a stable URL — faster, deterministic, and no Google
search dependency.

---

## License

MIT — see [LICENSE](LICENSE).

The framework parts in `src/lib/core/` are intended to be domain-agnostic;
contributions that keep them domain-agnostic are welcome. Disaster-specific
logic lives in `src/lib/sonae/`. See [CONTRIBUTING.md](CONTRIBUTING.md).

### Credits

- Geospatial Information Authority of Japan (GSI) — map tiles, geocoder
- Mozilla pdf.js — PDF parsing
- @napi-rs/canvas — Node.js canvas
- LM Studio — local model serving
- Google DeepMind — Gemma 4

---

## Links

- [The Gemma 4 Good Hackathon (Kaggle)](https://www.kaggle.com/competitions/gemma-4-good-hackathon)
- [Gemma 4 model on Kaggle](https://www.kaggle.com/models/google/gemma-4)
- [Gemma cookbook (Google)](https://github.com/google-gemma/cookbook)
- [GSI maps and geocoding API](https://www.gsi.go.jp/)
- [LM Studio](https://lmstudio.ai/)
