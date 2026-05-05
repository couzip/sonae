'use client';

import { useEffect, useMemo, useState } from 'react';
import { useFlowStore } from '@/stores/useFlowStore';
import { useResearchStore } from '@/stores/useResearchStore';
import { useLocationStore } from '@/stores/useLocationStore';
import { useProfileStore } from '@/stores/useProfileStore';
import { HUDFrame } from '@/components/cockpit';
import { ChecklistGroup } from '@/components/checklist/ChecklistGroup';
import {
  filterByDisaster,
  filterByProfile,
  type Countermeasure,
  type ProfileForFilter,
} from '@/lib/sonae/client/countermeasures-filter';
import { disasterJpToEnum } from '@/lib/sonae/client/disaster-mapping';

interface ChecklistResponse {
  code: string;
  detected_disasters: string[];
  items: Countermeasure[];
}

export function DisasterDetailPanel() {
  const setPhase = useFlowStore((s) => s.setPhase);
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

  const detectedEnums = useMemo(
    () =>
      // 言及されている災害種別はすべて対策フィルタに含める。シナリオが本編に
      // 無い (= ハザードマップ等の別資料に詳細が委ねられている) 場合でも、
      // 当該自治体で想定されているのは事実なので対策提示の対象にする。
      (result?.by_disaster_type ?? []).map((d) => disasterJpToEnum(d.disaster_type)),
    [result],
  );

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
    const byDisaster = filterByDisaster(items, detectedEnums, null);
    return filterByProfile(byDisaster, profileForFilter);
  }, [
    items,
    detectedEnums,
    building.year_built,
    building.construction,
    building.ownership,
    household.composition,
    lifestyle.location_types,
  ]);

  return (
    <HUDFrame
      title="対策チェックリスト"
      rightSlot={
        filteredItems && (
          <span className="text-xs text-ink-mute tabular-nums">
            {filteredItems.length} 件
          </span>
        )
      }
      className="h-full"
      bodyClassName="p-4 overflow-auto"
    >
      <div className="flex flex-col gap-4">
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

        <div className="flex justify-end sticky bottom-0 bg-bg/90 backdrop-blur py-2">
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
