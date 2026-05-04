'use client';

import { useEffect, useMemo } from 'react';
import { useFlowStore } from '@/stores/useFlowStore';
import { useLocationStore } from '@/stores/useLocationStore';
import { useChecklistStore } from '@/stores/useChecklistStore';
import { useProfileStore } from '@/stores/useProfileStore';
import { useRecommendationsStore } from '@/stores/useRecommendationsStore';
import { HUDFrame, MonoLabel, HairlineDivider } from '@/components/cockpit';
import { PriorityActionCard } from '@/components/recommendations/PriorityActionCard';
import { StrategicInsightCard } from '@/components/recommendations/StrategicInsightCard';

export function NextActionsScreen() {
  const reset = useFlowStore((s) => s.reset);
  const setPhase = useFlowStore((s) => s.setPhase);
  const municipality = useLocationStore((s) => s.municipality);
  const items = useChecklistStore((s) => s.items);
  const profileBuilding = useProfileStore((s) => s.building);
  const profileHousehold = useProfileStore((s) => s.household);
  const profileLifestyle = useProfileStore((s) => s.lifestyle);

  const status = useRecommendationsStore((s) => s.status);
  const result = useRecommendationsStore((s) => s.result);
  const error = useRecommendationsStore((s) => s.error);
  const generate = useRecommendationsStore((s) => s.generate);

  // Partition checklist state for current code from raw items.
  const checklistState = useMemo(() => {
    if (!municipality) return { completed: [], pending: [], not_applicable: [], unanswered: [] };
    const out = {
      completed: [] as string[],
      pending: [] as string[],
      not_applicable: [] as string[],
      unanswered: [] as string[],
    };
    const prefix = `${municipality.code}:`;
    for (const [k, v] of Object.entries(items)) {
      if (!k.startsWith(prefix)) continue;
      const id = k.slice(prefix.length);
      if (v === 'done') out.completed.push(id);
      else if (v === 'pending') out.pending.push(id);
      else if (v === 'na') out.not_applicable.push(id);
      else out.unanswered.push(id);
    }
    return out;
  }, [items, municipality]);

  // 自動生成: マウント時 (idle) または明示再実行
  useEffect(() => {
    if (!municipality) return;
    if (status === 'idle') {
      generate(
        municipality.code,
        municipality.name,
        {
          building: profileBuilding,
          household: profileHousehold,
          lifestyle: profileLifestyle,
        },
        checklistState,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [municipality?.code]);

  return (
    <HUDFrame
      serial="SONAE / SCN-05"
      title="次の活動方針"
      rightSlot={
        <MonoLabel size="2xs" tone="dim">
          PHASE 5 / 5
        </MonoLabel>
      }
      className="h-full"
      bodyClassName="p-4 overflow-auto"
    >
      <div className="flex flex-col gap-4 max-w-3xl mx-auto">
        {/* Strategic Insights — 計画を練る視点 (生存率を上げるための戦略アドバイス) */}
        {result?.strategic_insights && result.strategic_insights.length > 0 && (
          <section>
            <header className="flex items-baseline justify-between mb-2">
              <h2 className="font-sans text-base text-ink">計画の核心</h2>
              <MonoLabel size="2xs" tone="dim">
                {String(result.strategic_insights.length).padStart(2, '0')} INSIGHTS
              </MonoLabel>
            </header>
            <p className="font-sans text-xs text-ink-mute mb-3 leading-relaxed">
              あなたの状況で防災計画を練るとき、特に意識すべき視点です。
            </p>
            <div className="flex flex-col gap-2">
              {result.strategic_insights.map((it, i) => (
                <StrategicInsightCard
                  key={i}
                  index={i}
                  headline={it.headline}
                  rationale={it.rationale}
                  userFactor={it.user_factor}
                  delay={i * 0.06}
                />
              ))}
            </div>
          </section>
        )}

        {/* Encouragement */}
        {result?.encouragement && (
          <section className="border-hairline border-accent/40 bg-accent-soft/30 p-4 rounded-cockpit corner-tick">
            <MonoLabel size="2xs" tone="accent">
              これまでの取り組み
            </MonoLabel>
            <p className="mt-1 font-sans text-sm text-ink leading-relaxed">
              {result.encouragement}
            </p>
          </section>
        )}

        {/* Status */}
        {status === 'loading' && (
          <div className="border-hairline border-hairline rounded-cockpit p-4">
            <MonoLabel size="xs" tone="default">
              Gemma 4 が優先行動を生成中…
            </MonoLabel>
          </div>
        )}
        {status === 'error' && (
          <div className="border-hairline border-scale-lg/70 rounded-cockpit p-4 bg-bg-raised/40">
            <MonoLabel size="2xs" tone="default" className="text-scale-lg">
              ⚠ 生成失敗
            </MonoLabel>
            <p className="mt-1 font-sans text-xs text-ink-mute">{error}</p>
            <button
              type="button"
              onClick={() =>
                municipality &&
                generate(
                  municipality.code,
                  municipality.name,
                  {
                    building: profileBuilding,
                    household: profileHousehold,
                    lifestyle: profileLifestyle,
                  },
                  checklistState,
                )
              }
              className="mt-2 border-hairline border-hairline px-3 py-1 rounded-cockpit hover:border-accent transition-colors"
            >
              <MonoLabel size="2xs" tone="default">
                ▶ 再試行
              </MonoLabel>
            </button>
          </div>
        )}

        {/* Priority actions */}
        {result?.priority_actions && result.priority_actions.length > 0 && (
          <section>
            <header className="flex items-baseline justify-between mb-2">
              <h2 className="font-sans text-base text-ink">優先行動</h2>
              <MonoLabel size="2xs" tone="dim">
                {String(result.priority_actions.length).padStart(2, '0')} ITEMS
              </MonoLabel>
            </header>
            <div className="flex flex-col gap-2">
              {result.priority_actions.map((a, i) => (
                <PriorityActionCard
                  key={a.action_id}
                  index={i}
                  actionId={a.action_id}
                  label={a.action_id}
                  reasoning={a.reasoning}
                  urgency={a.urgency}
                  effortSummary={a.effort_summary}
                  relevantUserFactors={a.relevant_user_factors}
                  delay={i * 0.05}
                />
              ))}
            </div>
          </section>
        )}

        {/* Long-term considerations */}
        {result?.long_term_considerations && result.long_term_considerations.length > 0 && (
          <>
            <HairlineDivider variant="dashed" />
            <section>
              <h2 className="font-sans text-base text-ink mb-2">中長期で意識すること</h2>
              <ul className="flex flex-col gap-1">
                {result.long_term_considerations.map((c, i) => (
                  <li key={i} className="flex gap-2 items-start">
                    <span className="text-ink-dim">▸</span>
                    <span className="font-sans text-sm text-ink-mute leading-relaxed">{c}</span>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}

        <div className="mt-4 flex justify-between">
          <button
            onClick={() => setPhase('detail')}
            className="border-hairline border-hairline px-4 py-2 rounded-cockpit hover:border-accent transition-colors"
          >
            <MonoLabel size="xs" tone="mute">
              ◀ 詳細へ戻る
            </MonoLabel>
          </button>
          <button
            onClick={reset}
            className="border-hairline border-hairline px-4 py-2 rounded-cockpit hover:border-accent transition-colors"
          >
            <MonoLabel size="xs" tone="mute">
              最初から
            </MonoLabel>
          </button>
        </div>
      </div>
    </HUDFrame>
  );
}
