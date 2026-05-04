/**
 * Sonae domain types.
 *
 * The Sonae Pipeline maps to the generic core like this:
 *
 *   TQuery   = SonaeQuery        (municipality code + name)
 *   TSource  = SonaeSource       (PDF URL + page URL + label + section title hint)
 *   TBlob    = SonaeBlob         (local PDF path + sha256 + headers)
 *   TBlobMeta= HttpSourceMeta    (for freshness check, from core)
 *   TParsed  = SonaeParsed       (OCR markdown + section + scanned pages)
 *   TResult  = DisasterAssessment
 */

import type { HttpSourceMeta } from '@/lib/core';
import type { DisasterAssessment } from './schemas';

export interface SonaeQuery {
  municipality_code: string;
  city_name: string;
}

export interface SonaeSource {
  pdf_url: string;
  page_url?: string;
  pdf_label: string;
  /** Optional hint for section title to look for (e.g. "被害想定"). Falls back to LLM-driven TOC analysis. */
  section_hint?: string;
}

export interface SonaeBlob {
  pdf_path: string;
  sha256: string;
  http: HttpSourceMeta;
  size_bytes: number;
  downloaded_at: string;
}

export interface SonaeParsed {
  ocr_markdown: string;
  section: { title: string; page_count: number };
  scanned_pages: number[];
  /** Originating PDF sha256, for cascade invalidation. */
  source_sha256: string;
  source: SonaeSource;
}

export type SonaeResult = DisasterAssessment;
