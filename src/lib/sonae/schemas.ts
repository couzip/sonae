/**
 * Sonae domain Zod schemas + JSON Schema for LLM structured output.
 *
 * Lives in `lib/sonae/` because these are disaster-domain specific. Shared core
 * patterns (JSON repair, response_format builders) live in `lib/core/`.
 */

import { z } from 'zod';

// =============================================================================
// Phase 1: Discovery — PDF list from a website
// =============================================================================
export const PdfListSchema = z.object({
  page_url: z.string(),
  pdfs: z.array(z.object({ url: z.string(), label: z.string() })),
});
export type PdfList = z.infer<typeof PdfListSchema>;

export const PDF_LIST_JSON_SCHEMA = {
  type: 'json_schema',
  json_schema: {
    name: 'PdfList',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        page_url: { type: 'string' },
        pdfs: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              url: { type: 'string' },
              label: { type: 'string' },
            },
            required: ['url', 'label'],
          },
        },
      },
      required: ['page_url', 'pdfs'],
    },
  },
} as const;

// =============================================================================
// Phase 3: TOC parser — pick the section to extract
// =============================================================================
export const TocSelectionSchema = z.object({
  title: z.string(),
  logical_start_page: z.number().int(),
  logical_end_page: z.number().int(),
});
export type TocSelection = z.infer<typeof TocSelectionSchema>;

export const TOC_JSON_SCHEMA = {
  type: 'json_schema',
  json_schema: {
    name: 'TocSelection',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        title: {
          type: 'string',
          description:
            '目次に書かれているそのままのタイトル文字列。階層接頭辞 (章/節/項の番号や記号、英数字インデックス) を含めて返す',
        },
        logical_start_page: { type: 'integer' },
        logical_end_page: {
          type: 'integer',
          description:
            '対象セクションと同じ階層またはそれより上位の次の見出しの開始ページから 1 引いた値',
        },
      },
      required: ['title', 'logical_start_page', 'logical_end_page'],
    },
  },
} as const;

// =============================================================================
// Phase 5: Extract — disaster type enumeration + per-type scenarios
// =============================================================================
export const DISASTER_TYPE_ENUM = [
  '地震',
  '津波',
  '風水害',
  '洪水',
  '内水氾濫',
  '高潮',
  '土砂災害',
  '火山噴火',
  '雪害',
  '竜巻',
  '大規模火災',
  '林野火災',
  '危険物災害',
  '化学物質災害',
  '放射性物質災害',
  '海上災害',
  '鉄道災害',
  '道路災害',
  '航空災害',
  '大規模事故',
  '都市災害',
  '帰宅困難者',
  '雑踏事故',
  '不発弾災害',
] as const;

export type DisasterTypeJp = (typeof DISASTER_TYPE_ENUM)[number];

export const STEP_A_JSON_SCHEMA = {
  type: 'json_schema',
  json_schema: {
    name: 'DisasterTypes',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        types: {
          type: 'array',
          items: { type: 'string', enum: DISASTER_TYPE_ENUM },
          description: '文書中で言及されている災害種別。enum から該当するもの',
        },
      },
      required: ['types'],
    },
  },
} as const;

export const ScenarioSchema = z.object({
  name: z.string(),
  scale: z.string(),
  expected_damage: z.string(),
  category: z.enum(['想定', '実績']),
});
export type Scenario = z.infer<typeof ScenarioSchema>;

export const STEP_B_JSON_SCHEMA = {
  type: 'json_schema',
  json_schema: {
    name: 'TypeScenarios',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        scenarios: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              name: { type: 'string', description: 'シナリオの具体名' },
              scale: { type: 'string', description: '規模 (M値, 震度, 浸水深, 面積, 年月日 等)' },
              expected_damage: { type: 'string' },
              category: { type: 'string', enum: ['想定', '実績'] },
            },
            required: ['name', 'scale', 'expected_damage', 'category'],
          },
        },
      },
      required: ['scenarios'],
    },
  },
} as const;

export const DisasterByTypeSchema = z.object({
  disaster_type: z.string(),
  scenarios: z.array(ScenarioSchema),
  error: z.string().optional(),
});

export const DisasterAssessmentSchema = z.object({
  city: z.string(),
  by_disaster_type: z.array(DisasterByTypeSchema),
  source: z
    .object({
      pdf_url: z.string().optional(),
      page_url: z.string().optional(),
      pdf_label: z.string().optional(),
      section_title: z.string().optional(),
    })
    .optional(),
  generated_at: z.string().optional(),
});
export type DisasterAssessment = z.infer<typeof DisasterAssessmentSchema>;

// =============================================================================
// Next-actions LLM output (strategic insights + priority actions)
// =============================================================================
export const StrategicInsightSchema = z.object({
  headline: z.string(),
  rationale: z.string(),
  user_factor: z.string(),
});
export type StrategicInsight = z.infer<typeof StrategicInsightSchema>;

export const NextActionsSchema = z.object({
  strategic_insights: z.array(StrategicInsightSchema).min(2).max(4),
  priority_actions: z
    .array(
      z.object({
        action_id: z.string(),
        reasoning: z.string(),
        urgency: z.enum(['this_week', 'this_month', 'long_term']),
        effort_summary: z.string(),
        relevant_user_factors: z.array(z.string()),
      }),
    )
    .min(1)
    .max(7),
  encouragement: z.string(),
  long_term_considerations: z.array(z.string()),
});
export type NextActions = z.infer<typeof NextActionsSchema>;

export const NEXT_ACTIONS_JSON_SCHEMA = {
  type: 'json_schema',
  json_schema: {
    name: 'NextActions',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        strategic_insights: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              headline: { type: 'string' },
              rationale: { type: 'string' },
              user_factor: { type: 'string' },
            },
            required: ['headline', 'rationale', 'user_factor'],
          },
        },
        priority_actions: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              action_id: { type: 'string' },
              reasoning: { type: 'string' },
              urgency: { type: 'string', enum: ['this_week', 'this_month', 'long_term'] },
              effort_summary: { type: 'string' },
              relevant_user_factors: { type: 'array', items: { type: 'string' } },
            },
            required: [
              'action_id',
              'reasoning',
              'urgency',
              'effort_summary',
              'relevant_user_factors',
            ],
          },
        },
        encouragement: { type: 'string' },
        long_term_considerations: { type: 'array', items: { type: 'string' } },
      },
      required: [
        'strategic_insights',
        'priority_actions',
        'encouragement',
        'long_term_considerations',
      ],
    },
  },
} as const;

// =============================================================================
// Municipality registry
// =============================================================================
export const MunicipalitySchema = z.object({
  code: z.string(),
  name: z.string(),
  prefecture: z.string(),
  prefecture_code: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  name_aliases: z.array(z.string()).default([]),
  disaster_plan_url: z.string().optional(),
  disaster_plan_label: z.string().optional(),
  disaster_plan_page_url: z.string().optional(),
});
export type Municipality = z.infer<typeof MunicipalitySchema>;
