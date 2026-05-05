'use client';

import { useEffect, useMemo, useState } from 'react';
import { useFlowStore } from '@/stores/useFlowStore';
import { useLocationStore } from '@/stores/useLocationStore';
import { useChecklistStore } from '@/stores/useChecklistStore';
import { useProfileStore } from '@/stores/useProfileStore';
import { useRecommendationsStore } from '@/stores/useRecommendationsStore';
import { HUDFrame, HairlineDivider } from '@/components/cockpit';
import { PriorityActionCard } from '@/components/recommendations/PriorityActionCard';
import { StrategicInsightCard } from '@/components/recommendations/StrategicInsightCard';
import { SaveReportPdfButton } from '@/components/report/SaveReportPdfButton';
import type { Countermeasure } from '@/lib/sonae/client/countermeasures-filter';

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

  const [labelMap, setLabelMap] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!municipality) return;
    fetch(`/api/checklist?code=${encodeURIComponent(municipality.code)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { items: Countermeasure[] }) => {
        const m: Record<string, string> = {};
        for (const it of d.items) m[it.id] = it.label;
        setLabelMap(m);
      })
      .catch(() => {});
  }, [municipality?.code]);

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

  const retry = () =>
    municipality &&
    generate(
      municipality.code,
      municipality.name,
      { building: profileBuilding, household: profileHousehold, lifestyle: profileLifestyle },
      checklistState,
    );

  return (
    <HUDFrame title="次の活動方針" className="h-full" bodyClassName="p-4 overflow-auto">
      <div className="flex flex-col gap-4 max-w-3xl mx-auto">
        {result?.strategic_insights && result.strategic_insights.length > 0 && (
          <section>
            <header className="mb-2">
              <h3 className="font-sans text-base text-ink">計画の核心</h3>
              <p className="text-xs text-ink-mute mt-0.5">
                あなたの状況で、特に意識すべき視点です
              </p>
            </header>
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

        {result?.encouragement && (
          <section className="border-hairline border-accent/40 bg-accent-soft/30 p-4 rounded-cockpit">
            <p className="text-sm text-ink leading-relaxed">{result.encouragement}</p>
          </section>
        )}

        {status === 'loading' && (
          <div className="border-hairline border-hairline rounded-cockpit p-4 text-sm text-ink-mute">
            優先行動を生成しています
          </div>
        )}
        {status === 'error' && (
          <div className="border-hairline border-scale-lg/70 rounded-cockpit p-4 bg-bg-raised/40">
            <p className="text-sm text-scale-lg">{error}</p>
            <button
              type="button"
              onClick={retry}
              className="mt-2 border-hairline border-hairline px-3 py-1 rounded-cockpit hover:border-accent transition-colors text-xs text-ink"
            >
              再試行
            </button>
          </div>
        )}

        {result?.priority_actions && result.priority_actions.length > 0 && (
          <section>
            <h3 className="font-sans text-base text-ink mb-2">優先行動</h3>
            <div className="flex flex-col gap-2">
              {result.priority_actions.map((a, i) => (
                <PriorityActionCard
                  key={a.action_id}
                  label={labelMap[a.action_id] ?? a.action_id}
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

        {result?.long_term_considerations && result.long_term_considerations.length > 0 && (
          <>
            <HairlineDivider variant="dashed" />
            <section>
              <h3 className="font-sans text-base text-ink mb-2">中長期で意識すること</h3>
              <ul className="flex flex-col gap-1.5">
                {result.long_term_considerations.map((c, i) => (
                  <li key={i} className="text-sm text-ink-mute leading-relaxed">
                    {c}
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}

        <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
          <button
            onClick={() => setPhase('detail')}
            className="border-hairline border-hairline px-4 py-2 rounded-cockpit hover:border-accent transition-colors text-sm text-ink-mute"
          >
            詳細に戻る
          </button>
          <div className="flex items-center gap-3">
            <SaveReportPdfButton />
            <button
              onClick={reset}
              className="border-hairline border-hairline px-4 py-2 rounded-cockpit hover:border-accent transition-colors text-sm text-ink-mute"
            >
              最初から
            </button>
          </div>
        </div>
      </div>
    </HUDFrame>
  );
}
