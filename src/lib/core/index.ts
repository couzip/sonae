/**
 * Sonae core framework.
 *
 * Domain-agnostic building blocks for "lightweight LLMs consolidating scattered
 * public information" — the OSS reference implementation that Sonae itself is
 * built on.
 *
 * Layers: Discoverer → Retriever → Parser → Extractor (each with its own cache).
 *
 * Quick start: see `docs/EXTENDING.md` and `examples/`.
 */

export type {
  Cache,
  Discoverer,
  Extractor,
  Freshness,
  FreshnessVerdict,
  Parser,
  PipelineContext,
  Retriever,
} from './types';

export type { ProgressEvent, EmitFn, PhaseStatus } from './events';
export { noopEmit, withPhase } from './events';

export { Pipeline, type PipelineCaches, type PipelineConfig, type RunOptions } from './Pipeline';

export {
  createLlmClient,
  type LlmClient,
  type LlmClientConfig,
  type ChatJsonOptions,
  type ChatVisionOptions,
} from './llm';

export { repairTruncatedJson } from './repairJson';

export {
  JsonFileCache,
  TextFileCache,
  BinaryFileCache,
  PathHandleCache,
  type FileCacheOptions,
} from './fileCache';

export {
  createHttpFreshness,
  type HttpFreshnessOptions,
  type HttpFreshnessResult,
  type HttpServerHeaders,
  type HttpSourceMeta,
} from './httpFreshness';

export {
  getPdfPageCount,
  extractPdfText,
  hasUsefulTextLayer,
  renderPages,
  type RenderedPage,
} from './pdf';
