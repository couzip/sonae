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

import type { Extractor, LlmClient, PipelineContext, ReasoningEffort } from '@/lib/core';
import {
  DISASTER_TYPE_ENUM,
  STEP_A_JSON_SCHEMA,
  STEP_B_JSON_SCHEMA,
  type DisasterAssessment,
  type Scenario,
} from './schemas';
import type { SonaeParsed, SonaeQuery, SonaeSource } from './types';

function readEffort(envValue: string | undefined): ReasoningEffort {
  const v = (envValue ?? 'off').toLowerCase();
  if (v === 'low' || v === 'medium' || v === 'high') return v;
  return 'off';
}

interface StepAOut {
  types: string[];
}
interface StepBOut {
  scenarios: Scenario[];
}

export interface ExtractorOptions {
  llm: LlmClient;
  stepALlm?: LlmClient;
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

    const md = parsed.ocr_markdown;
    ctx.emit({
      type: 'log',
      phase: 'extract',
      message: `入力長: ${md.length}文字`,
    });

    // ----- Step A: disaster type enumeration -----
    const stepAPrompt = `${city}の地域防災計画から被害想定の章を抽出した文書を解析してください。

## タスク
この文書中で言及されている災害種別を、下記 enum から **漏れなく** 抽出してください。

- 歴史実績 / 想定シナリオ / リスク言及 のいずれでも、登場すれば含める
- 文書の冒頭から末尾まで全体を確認すること (前半に集中せず後半まで読む)
- 章 / 節 / 項が複数ある場合はそれぞれを別個に走査して、各セクションで言及される種別を全部拾うこと
- 同じ enum 値が複数回登場しても 1 件として扱う

## enum (この中からのみ選ぶ)
${DISASTER_TYPE_ENUM.join(' / ')}

## 文書
${md}`;
    const stepAEffort = readEffort(process.env.EXTRACT_STEP_A_REASONING_EFFORT);
    if (stepAEffort !== 'off') {
      ctx.emit({
        type: 'log',
        phase: 'extract',
        message: `[A] reasoning effort=${stepAEffort}`,
      });
    }
    const t_a = Date.now();
    const stepALlm = this.opts.stepALlm ?? this.opts.llm;
    const stepA = await stepALlm.chatJson<StepAOut>({
      prompt: stepAPrompt,
      responseFormat: STEP_A_JSON_SCHEMA,
      reasoningEffort: stepAEffort,
    });
    const allowedTypes = new Set<string>(DISASTER_TYPE_ENUM);
    const rawTypes = [...new Set(stepA.types ?? [])];
    const dropped = rawTypes.filter((t) => !allowedTypes.has(t));
    const types = rawTypes.filter((t) => allowedTypes.has(t));
    if (dropped.length) {
      ctx.emit({
        type: 'log',
        phase: 'extract',
        message: `[A] enum 違反で除外: ${dropped.join(', ')}`,
      });
    }
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
    const stepBEffort = readEffort(process.env.EXTRACT_STEP_B_REASONING_EFFORT);
    ctx.emit({
      type: 'log',
      phase: 'extract',
      message:
        stepBEffort !== 'off'
          ? `[B] 各種別ごとに scenarios 抽出 (${types.length} calls, reasoning=${stepBEffort})`
          : `[B] 各種別ごとに scenarios 抽出 (${types.length} calls)`,
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
          reasoningEffort: stepBEffort,
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
