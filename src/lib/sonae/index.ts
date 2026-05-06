/**
 * Sonae domain entry point.
 *
 * Public API of the disaster-domain Pipeline. Other layers (Next.js routes,
 * tests, UI) should import from here, not from the per-layer files.
 */

export {
  runSonaePipeline,
  runSonaePipelineAsAdmin,
  getSonaePipeline,
  getSonaePipelineForAdmin,
  readSonaeResult,
  type SonaeRunOptions,
} from './pipeline';

export { findByCode, findByName, findNearestByCoords, listRegistry } from './municipality';

export type {
  DisasterAssessment,
  DisasterTypeJp,
  Municipality,
  NextActions,
  Scenario,
  StrategicInsight,
} from './schemas';

export { DISASTER_TYPE_ENUM, NextActionsSchema } from './schemas';

export type { SonaeBlob, SonaeParsed, SonaeQuery, SonaeSource } from './types';

export { loadCountermeasures, filterByDetectedDisasters } from './countermeasures';
export {
  generateNextActions,
  normalizeChecklistStateForActions,
  type NextActionsChecklistState,
  type NextActionsInput,
} from './nextActions';

/**
 * The set of phase names emitted by the Sonae pipeline. Client UI consumers
 * (PhaseStepIndicator, LogTicker, etc.) should rely on this list, not the
 * generic `string` phase from `@/lib/core/events`.
 */
export type SonaePhase =
  | 'lookup'
  | 'cache_check'
  | 'discovery'
  | 'retrieval'
  | 'toc'
  | 'ocr_scan'
  | 'ocr_section'
  | 'extract'
  | 'done';
