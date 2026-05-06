import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  filterByDetectedDisasters,
  generateNextActions,
  loadCountermeasures,
  normalizeChecklistStateForActions,
  readSonaeResult,
  type NextActionsInput,
} from '@/lib/sonae';
import { filterByProfile, type ProfileForFilter } from '@/lib/sonae/client/countermeasures-filter';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const BuildingTypeSchema = z.enum(['wood', 'steel', 'rc', 'src']);
const OwnershipSchema = z.enum(['owned', 'rented']);
const HouseholdMemberSchema = z.enum([
  'alone',
  'adults',
  'children',
  'infant',
  'elderly',
  'care_needed',
  'pets',
]);
const LocationTypeSchema = z.enum(['coastal', 'inland', 'mountainous', 'urban']);

const RequestSchema = z.object({
  location: z.object({
    municipality_code: z.string(),
    name: z.string(),
  }),
  user_profile: z.object({
    building: z
      .object({
        year_built: z.number().nullable().optional(),
        construction: BuildingTypeSchema.nullable().optional(),
        total_floors: z.number().nullable().optional(),
        living_floor: z.number().nullable().optional(),
        ownership: OwnershipSchema.nullable().optional(),
      })
      .optional(),
    household: z
      .object({
        composition: z.array(HouseholdMemberSchema).optional(),
        members_count: z.number().nullable().optional(),
      })
      .optional(),
    lifestyle: z
      .object({
        weekday_location: z.string().nullable().optional(),
        has_car: z.boolean().nullable().optional(),
        location_types: z.array(LocationTypeSchema).optional(),
      })
      .optional(),
  }),
  checklist_state: z.object({
    completed: z.array(z.string()),
    pending: z.array(z.string()),
    not_applicable: z.array(z.string()),
    unanswered: z.array(z.string()),
  }),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid body', issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const reqBody = parsed.data;

  // サーバー側で detected_disasters を municipality cache から取得
  const cached = await readSonaeResult(reqBody.location.municipality_code);
  if (!cached) {
    return NextResponse.json(
      { error: 'no assessment for this code; run /api/disasters first' },
      { status: 404 },
    );
  }
  const detected_disasters = cached.by_disaster_type
    .filter((d) => d.scenarios.length > 0)
    .map((d) => ({
      type: d.disaster_type,
      severity: null,
      scenario: d.scenarios[0]?.name ?? null,
    }));

  // プロファイル + 検出災害で countermeasures を絞り込み
  const master = loadCountermeasures();
  const byDisaster = filterByDetectedDisasters(
    master,
    detected_disasters.map((d) => d.type),
  );
  const profileForFilter: ProfileForFilter = {
    building: {
      year_built: reqBody.user_profile.building?.year_built,
      construction: reqBody.user_profile.building?.construction,
      ownership: reqBody.user_profile.building?.ownership,
    },
    household: { composition: reqBody.user_profile.household?.composition },
    location_types: reqBody.user_profile.lifestyle?.location_types,
  };
  const available_actions = filterByProfile(byDisaster, profileForFilter);
  const checklist_state = normalizeChecklistStateForActions(
    reqBody.checklist_state,
    available_actions,
  );

  const input: NextActionsInput = {
    location: reqBody.location,
    detected_disasters,
    user_profile: reqBody.user_profile,
    checklist_state,
    available_actions,
  };

  try {
    const result = await generateNextActions(input);
    // action_id ∈ available_actions の不変条件を確認 (LLM がでっち上げないか)
    const validIds = new Set(available_actions.map((a) => a.id));
    const filtered = result.priority_actions.filter((a) => validIds.has(a.action_id));
    return NextResponse.json({
      ...result,
      priority_actions: filtered,
      meta: {
        candidate_count: available_actions.length,
        completed_count: checklist_state.completed.length,
        pending_count: checklist_state.pending.length + checklist_state.unanswered.length,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: 'LLM 呼び出しに失敗', detail: msg }, { status: 500 });
  }
}
