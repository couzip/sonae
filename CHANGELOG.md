# Changelog

All notable changes to Sonae will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project (will eventually) adhere to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Generic `Pipeline` framework in `src/lib/core/` with four layer interfaces
  (Discoverer / Retriever / Parser / Extractor), five-tier caching
  (source / blob / parsed / result + meta), HTTP HEAD freshness check, and
  SSE-style progress events.
- Reference implementation in `src/lib/sonae/` — disaster-plan PDF pipeline
  with TOC-driven partial OCR and map-reduce structured extraction.
- `src/lib/sonae/client/` — client-safe (browser-bundleable) types and
  filter functions, separate from server-only loader code.
- Example pipeline `examples/news-summarizer/` — minimal HTTP + HTML + LLM
  pipeline demonstrating that the framework works for non-disaster domains.
- 52 unit + integration tests covering JSON repair, profile filtering,
  disaster mapping, target-PDF picking, the full Pipeline cache machinery,
  file caches, and a hermetic Sonae integration run.
- CI on Node 20.x and 22.x (typecheck / lint / format / test with 70%
  coverage threshold).
- LICENSE (MIT), CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, Dependabot config,
  issue / PR templates, EXTENDING guide.

### Changed
- `Pipeline.run` now threads `query` and `source` through `PipelineContext`,
  removing the previous mutable-closure pattern in `pipeline.ts`. Layer
  implementations read `ctx.query` / `ctx.source` directly.
- `forceExtract` run option renamed to `forceParseAndExtract` to reflect that
  it re-runs both Parser and Extractor. Old name kept as deprecated alias for
  one minor release.

### Fixed
- `pdfjs-dist` cmap URL handling on Windows: paths are now normalized to
  `file://` URLs via `pathToFileURL`, eliminating the "must include trailing
  slash" failure on backslash-separated paths.
- `repairTruncatedJson` upgraded from a one-pass bracket-balancing repair to
  a four-strategy staged recovery (drop unterminated string, trim partial
  tokens, then close brackets).
- Coastal / mountainous countermeasures now display permissively when the
  user has not declared `location_types` (per spec §6.1 「未入力でも動く」).

### Removed
- The monolithic `lib/pipeline/orchestrator.ts` — replaced by Pipeline
  configuration in `lib/sonae/pipeline.ts`.
- `pdf-to-png-converter` dependency — replaced by direct pdfjs-dist 5.6 +
  `@napi-rs/canvas` usage following the official Mozilla pdf.js Node sample.
