/**
 * Sonae Extractor (Phase 5).
 *
 * Map-reduce structured extraction with Gemma 4 (or any OpenAI-compatible LLM):
 *   Step A: enumerate disaster types mentioned in the text.
 *   Step B: for each type, extract scenarios in parallel.
 *
 * The two-step shape lets a small model (4B) handle a large document by
 * reducing per-call attention demand.
 */

import type { Extractor, LlmClient, PipelineContext } from '@/lib/core';
import {
  STEP_A_JSON_SCHEMA,
  STEP_B_JSON_SCHEMA,
  type DisasterAssessment,
  type Scenario,
} from './schemas';
import type { SonaeParsed, SonaeQuery, SonaeSource } from './types';

const HARD_MAX = 110_000;

interface StepAOut {
  types: string[];
}
interface StepBOut {
  scenarios: Scenario[];
}

export interface ExtractorOptions {
  llm: LlmClient;
}

export class SonaeMapReduceExtractor implements Extractor<
  SonaeParsed,
  DisasterAssessment,
  SonaeQuery,
  SonaeSource
> {
  constructor(private readonly opts: ExtractorOptions) {}

  async extract(
    parsed: SonaeParsed,
    ctx: PipelineContext<SonaeQuery, SonaeSource>,
  ): Promise<DisasterAssessment> {
    const city = ctx.query?.city_name;
    if (!city) throw new Error('SonaeMapReduceExtractor: ctx.query.city_name missing');
    ctx.emit({
      type: 'phase',
      phase: 'extract',
      status: 'started',
      message: `map-reduce 解析開始`,
    });

    const md =
      parsed.ocr_markdown.length > HARD_MAX
        ? parsed.ocr_markdown.slice(0, HARD_MAX / 2) +
          '\n\n[... 中略 ...]\n\n' +
          parsed.ocr_markdown.slice(-HARD_MAX / 2)
        : parsed.ocr_markdown;
    ctx.emit({
      type: 'log',
      phase: 'extract',
      message: `入力長: ${md.length}文字 (元 ${parsed.ocr_markdown.length}文字)`,
    });

    // ----- Step A: disaster type enumeration -----
    const stepAPrompt = `以下は${city}の地域防災計画から被害想定の章を抽出した文書です。
この文書中で **言及されている災害種別** をすべて enum から抽出してください。
歴史実績/想定シナリオ どちらでも、その災害種別が言及されていれば含める。

--- 文書 ---
${md}
---`;
    const t_a = Date.now();
    const stepA = await this.opts.llm.chatJson<StepAOut>({
      prompt: stepAPrompt,
      responseFormat: STEP_A_JSON_SCHEMA,
      maxTokens: 1024,
    });
    const types = [...new Set(stepA.types ?? [])];
    ctx.emit({
      type: 'log',
      phase: 'extract',
      message: `[A] ${((Date.now() - t_a) / 1000).toFixed(1)}s, types(${types.length}): ${types.join(', ')}`,
    });

    if (!types.length) {
      return {
        city,
        by_disaster_type: [],
        source: {
          pdf_url: parsed.source.pdf_url,
          page_url: parsed.source.page_url,
          pdf_label: parsed.source.pdf_label,
          section_title: parsed.section.title,
        },
        generated_at: new Date().toISOString(),
      };
    }

    // ----- Step B: per-type scenarios -----
    ctx.emit({
      type: 'log',
      phase: 'extract',
      message: `[B] 各種別ごとに scenarios 抽出 (${types.length} calls)`,
    });
    const t_b = Date.now();
    const byType: DisasterAssessment['by_disaster_type'] = [];
    let totalScenarios = 0;
    for (const t of types) {
      const stepBPrompt = `以下は${city}の地域防災計画から被害想定の章を抽出した文書です。
この文書から **「${t}」に関する** シナリオだけを抽出してください。
他の災害種別は無視。「${t}」だけにフォーカスする。

各シナリオについて name / scale / expected_damage / category を埋める。
category は '想定' (将来想定) または '実績' (過去発生)。
文書に明記されている内容のみ。推測しない。
「${t}」が文書に登場しなければ scenarios=[] で返す。

--- 文書 ---
${md}
---`;
      try {
        const t0 = Date.now();
        const stepB = await this.opts.llm.chatJson<StepBOut>({
          prompt: stepBPrompt,
          responseFormat: STEP_B_JSON_SCHEMA,
          maxTokens: 4096,
        });
        const dt = ((Date.now() - t0) / 1000).toFixed(1);
        const ss = stepB.scenarios ?? [];
        ctx.emit({
          type: 'log',
          phase: 'extract',
          message: `  ${t}: ${dt}s, ${ss.length} scenarios`,
        });
        byType.push({ disaster_type: t, scenarios: ss });
        totalScenarios += ss.length;
      } catch (e: any) {
        ctx.emit({
          type: 'log',
          phase: 'extract',
          message: `  ${t}: 失敗 (${e?.message})`,
        });
        byType.push({ disaster_type: t, scenarios: [], error: e?.message });
      }
    }
    ctx.emit({
      type: 'phase',
      phase: 'extract',
      status: 'done',
      message: `計 ${((Date.now() - t_b) / 1000).toFixed(1)}s, 合計 ${totalScenarios} scenarios`,
    });

    return {
      city,
      by_disaster_type: byType,
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
