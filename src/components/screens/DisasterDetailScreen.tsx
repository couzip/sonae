'use client';

import { useEffect, useMemo, useState } from 'react';
import { useFlowStore } from '@/stores/useFlowStore';
import { useResearchStore } from '@/stores/useResearchStore';
import { useLocationStore } from '@/stores/useLocationStore';
import { useProfileStore } from '@/stores/useProfileStore';
import { HUDFrame, HairlineDivider, SourceLink } from '@/components/cockpit';
import { ChecklistGroup } from '@/components/checklist/ChecklistGroup';
import {
  filterByDisaster,
  filterByProfile,
  type Countermeasure,
  type ProfileForFilter,
} from '@/lib/sonae/client/countermeasures-filter';

import { isMeaningful } from '@/lib/sonae/client/meaningful';

interface ChecklistResponse {
  code: string;
  detected_disasters: string[];
  items: Countermeasure[];
}

export function DisasterDetailScreen() {
  const setPhase = useFlowStore((s) => s.setPhase);
  const selected = useFlowStore((s) => s.selectedDisaster);
  const result = useResearchStore((s) => s.result);
  const municipality = useLocationStore((s) => s.municipality);
  const building = useProfileStore((s) => s.building);
  const household = useProfileStore((s) => s.household);
  const lifestyle = useProfileStore((s) => s.lifestyle);

  const [items, setItems] = useState<Countermeasure[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const code = municipality?.code;
  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    fetch(`/api/checklist?code=${encodeURIComponent(code)}`)
      .then(async (r) => {
        if (!r.ok) {
          const e = await r.json().catch(() => ({}));
          throw new Error(e.error ?? `HTTP ${r.status}`);
        }
        return (await r.json()) as ChecklistResponse;
      })
      .then((data) => {
        if (!cancelled) setItems(data.items);
      })
      .catch((e) => {
        if (!cancelled) setLoadError(String(e?.message ?? e));
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  const filteredItems = useMemo(() => {
    if (!items) return null;
    const profileForFilter: ProfileForFilter = {
      building: {
        year_built: building.year_built,
        construction: building.construction,
        ownership: building.ownership,
      },
      household: { composition: household.composition },
      location_types: lifestyle.location_types,
    };
    const byDisaster = filterByDisaster(items, [], selected?.enumType ?? null);
    return filterByProfile(byDisaster, profileForFilter);
  }, [
    items,
    selected?.enumType,
    building.year_built,
    building.construction,
    building.ownership,
    household.composition,
    lifestyle.location_types,
  ]);

  const detectedDisaster = result?.by_disaster_type.find(
    (d) => d.disaster_type === selected?.jpType,
  );

  const scenarios = (detectedDisaster?.scenarios ?? []).filter(
    (s) => isMeaningful(s.name) || isMeaningful(s.scale) || isMeaningful(s.expected_damage),
  );

  return (
    <HUDFrame
      title={selected?.jpType ?? '災害詳細'}
      className="h-full"
      bodyClassName="p-4 overflow-auto"
    >
      <div className="flex flex-col gap-4 max-w-3xl mx-auto">
        <section>
          <header className="flex items-baseline justify-between mb-2">
            <h3 className="font-sans text-base text-ink">想定される事象</h3>
            {scenarios.length > 0 && (
              <span className="text-xs text-ink-mute tabular-nums">{scenarios.length}件</span>
            )}
          </header>
          {scenarios.length > 0 ? (
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {scenarios.map((s, i) => {
                const name = isMeaningful(s.name) ? s.name : '想定シナリオ';
                const scale = isMeaningful(s.scale) ? s.scale : null;
                const damage = isMeaningful(s.expected_damage) ? s.expected_damage : null;
                return (
                  <li
                    key={i}
                    className="border-hairline border-hairline rounded-cockpit bg-bg-raised/40 p-3 flex flex-col gap-1.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-sans text-sm text-ink leading-snug min-w-0 break-words">
                        {name}
                      </h4>
                      {result?.source?.pdf_url && (
                        <SourceLink
                          index={i + 1}
                          title={result.source.pdf_label ?? '出典'}
                          url={result.source.pdf_url}
                        />
                      )}
                    </div>
                    {scale && (
                      <div className="text-xs text-ink-mute tabular-nums leading-snug">{scale}</div>
                    )}
                    {damage && (
                      <p className="text-xs text-ink-mute leading-relaxed mt-0.5">{damage}</p>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-ink-mute">想定の記載がありません</p>
          )}
        </section>

        <HairlineDivider variant="dashed" />

        <section>
          <header className="flex items-baseline justify-between mb-2">
            <h3 className="font-sans text-base text-ink">該当する対策</h3>
            <span className="text-xs text-ink-mute">あなたの状況に合わせて表示しています</span>
          </header>
          {loadError && (
            <div className="border-hairline border-scale-lg bg-bg-raised/50 p-3 rounded-cockpit text-sm text-scale-lg">
              {loadError}
            </div>
          )}
          {!items && !loadError && <p className="text-sm text-ink-mute">読み込み中</p>}
          {filteredItems && municipality && (
            <ChecklistGroup
              items={filteredItems}
              municipalityCode={municipality.code}
              groupBy="category"
            />
          )}
        </section>

        <HairlineDivider variant="dashed" />

        <div className="flex justify-between sticky bottom-0 bg-bg/90 backdrop-blur py-2">
          <button
            onClick={() => setPhase('grid')}
            className="border-hairline border-hairline px-4 py-2 rounded-cockpit hover:border-accent transition-colors text-sm text-ink-mute"
          >
            災害一覧に戻る
          </button>
          <button
            onClick={() => setPhase('actions')}
            className="border-hairline border-accent bg-accent-soft px-4 py-2 rounded-cockpit hover:bg-accent-dim transition-colors text-sm text-accent"
          >
            次の活動方針へ
          </button>
        </div>
      </div>
    </HUDFrame>
  );
}
