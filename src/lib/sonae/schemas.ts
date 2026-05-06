import { z } from 'zod';

export const PdfListSchema = z.object({
  page_url: z.string(),
  pdfs: z.array(z.object({ url: z.string(), label: z.string() })),
});
export type PdfList = z.infer<typeof PdfListSchema>;

export const PickResultSchema = z.object({
  pick_index: z.number().int().describe('選んだ PDF の index (0-based)'),
  reason: z.string().describe('選定理由 (50 字程度)'),
});
export type PickResult = z.infer<typeof PickResultSchema>;

export const TocSelectionSchema = z.object({
  title: z
    .string()
    .describe(
      '目次に書かれているそのままのタイトル文字列。階層接頭辞 (章/節/項の番号や記号、英数字インデックス) を含めて返す',
    ),
  logical_start_page: z.number().int(),
  logical_end_page: z
    .number()
    .int()
    .describe('対象セクションと同じ階層またはそれより上位の次の見出しの開始ページから 1 引いた値'),
});
export type TocSelection = z.infer<typeof TocSelectionSchema>;

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

export const StepATypesSchema = z.object({
  types: z
    .array(z.enum(DISASTER_TYPE_ENUM))
    .describe('文書中で言及されている災害種別。enum から該当するもの'),
});
export type StepATypes = z.infer<typeof StepATypesSchema>;

export const ScenarioSchema = z.object({
  name: z.string().describe('シナリオの具体名'),
  scale: z.string().describe('規模 (M値, 震度, 浸水深, 面積, 年月日 等)'),
  expected_damage: z.string(),
  category: z.enum(['想定', '実績']),
});
export type Scenario = z.infer<typeof ScenarioSchema>;

export const StepBScenariosSchema = z.object({
  scenarios: z.array(ScenarioSchema),
});
export type StepBScenarios = z.infer<typeof StepBScenariosSchema>;

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
