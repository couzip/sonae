/**
 * Next-actions LLM call.
 *
 * Uses the "攻撃 − 防御 = 生存率" framing: pre-event physical defense is
 * always Tier 1; pre-event planning is Tier 2; post-event coping (stockpile)
 * is Tier 3. The prompt makes this priority explicit and the model selects
 * `strategic_insights` and `priority_actions` accordingly.
 */

import type { Countermeasure } from '@/lib/sonae/client/countermeasures-filter';
import { getLlm } from './llmRoles';
import { NEXT_ACTIONS_JSON_SCHEMA, type NextActions } from './schemas';

export interface NextActionsInput {
  location: { municipality_code: string; name: string };
  detected_disasters: Array<{ type: string; severity: string | null; scenario: string | null }>;
  user_profile: {
    building?: {
      year_built?: number | null;
      construction?: string | null;
      total_floors?: number | null;
      living_floor?: number | null;
      ownership?: string | null;
    };
    household?: {
      composition?: string[];
      members_count?: number | null;
    };
    lifestyle?: {
      weekday_location?: string | null;
      has_car?: boolean | null;
    };
  };
  checklist_state: {
    completed: string[];
    pending: string[];
    not_applicable: string[];
    unanswered: string[];
  };
  available_actions: Countermeasure[];
}

export function summarizeProfile(p: NextActionsInput['user_profile']): string {
  const parts: string[] = [];
  if (p.building?.year_built) {
    const age = new Date().getFullYear() - p.building.year_built;
    parts.push(`築${age}年(${p.building.year_built}年)`);
  }
  if (p.building?.construction) parts.push(p.building.construction);
  if (p.building?.ownership) parts.push(p.building.ownership === 'owned' ? '所有' : '賃貸');
  if (p.building?.total_floors) parts.push(`${p.building.total_floors}階建`);
  if (p.building?.living_floor) parts.push(`${p.building.living_floor}階居住`);
  if (p.household?.composition?.length) parts.push(`同居: ${p.household.composition.join('/')}`);
  return parts.length ? parts.join(' / ') : '未入力';
}

export async function generateNextActions(input: NextActionsInput): Promise<NextActions> {
  const { location, detected_disasters, user_profile, checklist_state, available_actions } = input;

  // pending + unanswered の中からのみ推奨対象
  const candidateIds = new Set([...checklist_state.pending, ...checklist_state.unanswered]);
  const candidates = available_actions.filter((a) => candidateIds.has(a.id));

  const prompt = `あなたは防災計画の戦略アドバイザーです。
この人が災害から生き延び、家族を守るために、計画を練る上での視点と具体的行動を返してください。

【最重要の思想 — これを全ての判断軸にする】
「攻撃 − 防御 = 生存率」
- 攻撃: 災害そのものの規模 (M7.3 の揺れ、3m の浸水、火災の延焼)
- 防御: **災害が起きる前に物理的に施す対策**。建物の耐震性、家具固定、感震ブレーカー、止水板、屋根軽量化等
- これがゼロや弱い状態だと、初期の数十秒〜数分で生存が決まる。**備蓄や避難計画は「攻撃を受けた後にどう生き延びるか」の話で、防御がゼロなら役に立たない**

優先順位の階層:
- Tier 1 (最重要 / 防御):  カテゴリ "物理対策" "建物対策" — 倒壊・転倒・延焼・浸水を物理的に止める。ここに最大の leverage がある
- Tier 2 (起きる前の準備): カテゴリ "認知" "計画" — ハザードマップ確認、避難判断基準、警報設定、家族連絡手段
- Tier 3 (起きた後の対応): カテゴリ "備蓄" — 水・食料・非常持出袋。**生死は決めない、生活の質を保つ**

strategic_insights は **Tier 1 の視点を最低 1 件含めること**。
priority_actions も Tier 1 の未着手項目があれば最優先で入れること。Tier 3 ばかりにしない。

[location]
${location.name} (code: ${location.municipality_code})

[detected_disasters]
${detected_disasters.map((d) => `- ${d.type}${d.severity ? ` (${d.severity})` : ''}${d.scenario ? `: ${d.scenario}` : ''}`).join('\n')}

[user_profile]
${summarizeProfile(user_profile)}

[checklist_state]
完了済み (${checklist_state.completed.length}件): ${checklist_state.completed.slice(0, 8).join(', ') || 'なし'}
未着手・未回答 (${checklist_state.pending.length + checklist_state.unanswered.length}件): ${[...checklist_state.pending, ...checklist_state.unanswered].slice(0, 12).join(', ')}
該当なし: ${checklist_state.not_applicable.join(', ') || 'なし'}

[available_actions] (category タグで Tier を判別: 物理対策/建物対策=Tier1, 認知/計画=Tier2, 備蓄=Tier3)
${candidates
  .map(
    (a) =>
      `- ${a.id} [${a.category}]: ${a.label} (時間=${a.effort.time}, 費用=${a.effort.cost}, 効果=${a.impact})${
        a.short_description ? '\n    ' + a.short_description : ''
      }`,
  )
  .join('\n')}

出力は4つのフィールドを含む JSON です。

(1) strategic_insights (2〜4件)
この人の状況で **生存率を上げるために特に意識すべき戦略的視点** を返す。
- 「攻撃 - 防御 = 生存率」のフレームに沿って、**Tier 1 (物理防御) を強調する視点を最低 1 件含める**。
  例: 「家が倒れない・燃えないことが他の全ての前提」「家具転倒は地震負傷の最大要因。固定が最も費用対効果が高い防御」
- 残りの insight も「起きる前にどう減衰させるか」を軸にする。「起きた後の対応(備蓄・避難)」だけで構成しない。
- headline: 20文字程度の見出し。具体的対策名(「家具固定」)ではなく、計画全体を貫く考え方を。
- rationale: なぜその視点が重要か、どう判断材料にするかを2〜4文。
- user_factor: この視点が特にこの人に当てはまる理由 (例: "築41年木造・旧耐震基準" "海岸沿い・乳幼児あり")。

(2) priority_actions (3〜7件)
- action_id は available_actions に存在するもののみ。
- pending または unanswered からのみ選ぶ。
- reasoning は同居家族属性と建物条件を組み込む。
- urgency: this_week / this_month / long_term の3値。
- effort_summary は所要時間と費用を簡潔に (例: "1-2時間 / 3,000-5,000円")。
- relevant_user_factors は ["築年数", "高齢同居"] のような短いタグ。

(3) encouragement
completed の中の具体的な対策名を最低1つ言及して、これまでの取り組みを認める。

(4) long_term_considerations
中長期で意識すべきこと 2-4個。

出力は指定スキーマの JSON のみ。前置きや説明文は不要。`;

  return await getLlm('next_actions').chatJson<NextActions>({
    prompt,
    responseFormat: NEXT_ACTIONS_JSON_SCHEMA,
  });
}
