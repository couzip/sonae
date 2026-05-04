'use client';

import { useEffect, useMemo, useState } from 'react';
import { useFlowStore } from '@/stores/useFlowStore';
import { useResearchStore } from '@/stores/useResearchStore';
import { useLocationStore } from '@/stores/useLocationStore';
import { useProfileStore } from '@/stores/useProfileStore';
import { HUDFrame, MonoLabel, DataLine, HairlineDivider, SourceLink } from '@/components/cockpit';
import { ChecklistGroup } from '@/components/checklist/ChecklistGroup';
import {
  filterByDisaster,
  filterByProfile,
  type Countermeasure,
  type ProfileForFilter,
} from '@/lib/sonae/client/countermeasures-filter';

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
  const profile = useProfileStore((s) => ({
    building: s.building,
    household: s.household,
    lifestyle: s.lifestyle,
  }));

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

  // 選択された災害種別 + 共通対策のみ表示。プロファイルでさらにフィルタ。
  // ロジックは lib/countermeasures-filter.ts に集約 (server / client 共通)。
  const filteredItems = useMemo(() => {
    if (!items) return null;
    const profileForFilter: ProfileForFilter = {
      building: {
        year_built: profile.building.year_built,
        construction: profile.building.construction,
        ownership: profile.building.ownership,
      },
      household: { composition: profile.household.composition },
      location_types: profile.lifestyle.location_types,
    };
    const byDisaster = filterByDisaster(items, [], selected?.enumType ?? null);
    return filterByProfile(byDisaster, profileForFilter);
  }, [
    items,
    selected?.enumType,
    profile.building.year_built,
    profile.building.construction,
    profile.building.ownership,
    profile.household.composition,
    profile.lifestyle.location_types,
  ]);

  const detectedDisaster = result?.by_disaster_type.find(
    (d) => d.disaster_type === selected?.jpType,
  );

  return (
    <HUDFrame
      serial="SONAE / SCN-04"
      title={`災害詳細 — ${selected?.jpType ?? '未選択'}`}
      rightSlot={
        <MonoLabel size="2xs" tone="dim">
          PHASE 4 / 5
        </MonoLabel>
      }
      className="h-full"
      bodyClassName="p-4 overflow-auto"
    >
      <div className="flex flex-col gap-4 max-w-3xl mx-auto">
        {/* 想定される事象 */}
        <section>
          <header className="flex items-baseline justify-between mb-2">
            <h2 className="font-sans text-base text-ink">想定される事象</h2>
            {detectedDisaster && (
              <MonoLabel size="2xs" tone="mute">
                {String(detectedDisaster.scenarios.length).padStart(2, '0')} SCENARIOS
              </MonoLabel>
            )}
          </header>
          <div className="corner-tick border-hairline border-hairline rounded-cockpit bg-bg-raised/30 p-3">
            {detectedDisaster && detectedDisaster.scenarios.length ? (
              <ul className="flex flex-col gap-2">
                {detectedDisaster.scenarios.map((s, i) => (
                  <li key={i}>
                    <DataLine
                      label={s.name}
                      value={s.scale || '—'}
                      source={
                        result?.source?.pdf_url ? (
                          <SourceLink
                            index={i + 1}
                            title={result.source.pdf_label ?? '出典'}
                            url={result.source.pdf_url}
                          />
                        ) : undefined
                      }
                    />
                    {s.expected_damage &&
                      s.expected_damage !== '記載なし' &&
                      s.expected_damage !== '不明' && (
                        <p className="font-sans text-xs text-ink-mute mt-0.5 leading-relaxed pl-2">
                          {s.expected_damage}
                        </p>
                      )}
                  </li>
                ))}
              </ul>
            ) : (
              <MonoLabel size="xs" tone="dim">
                想定の記載がありません
              </MonoLabel>
            )}
          </div>
        </section>

        <HairlineDivider variant="dashed" />

        {/* チェックリスト */}
        <section>
          <header className="flex items-baseline justify-between mb-2">
            <h2 className="font-sans text-base text-ink">該当する対策</h2>
            <MonoLabel size="2xs" tone="dim">
              プロファイルで自動絞込み
            </MonoLabel>
          </header>
          {loadError && (
            <div className="border-hairline border-scale-lg bg-bg-raised/50 p-3 rounded-cockpit">
              <MonoLabel size="2xs" tone="default" className="text-scale-lg">
                ⚠ {loadError}
              </MonoLabel>
            </div>
          )}
          {!items && !loadError && (
            <MonoLabel size="xs" tone="dim">
              対策を読み込み中...
            </MonoLabel>
          )}
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
            className="border-hairline border-hairline px-4 py-2 rounded-cockpit hover:border-accent transition-colors"
          >
            <MonoLabel size="xs" tone="mute">
              ◀ 災害グリッドへ
            </MonoLabel>
          </button>
          <button
            onClick={() => setPhase('actions')}
            className="border-hairline border-accent bg-accent-soft px-4 py-2 rounded-cockpit hover:bg-accent-dim transition-colors"
          >
            <MonoLabel size="xs" tone="accent">
              完了 → 次の活動方針 ▶
            </MonoLabel>
          </button>
        </div>
      </div>
    </HUDFrame>
  );
}
