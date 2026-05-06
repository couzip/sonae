'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { computeTreemap, type TreemapInput } from '@/lib/treemap/squarify';
import type { DisasterAssessment, Scenario } from '@/lib/sonae';
import { disasterJpToEnum } from '@/lib/sonae/client/disaster-mapping';
import { disasterTone } from '@/lib/sonae/client/disaster-style';
import { isMeaningful } from '@/lib/sonae/client/meaningful';
import { MonoLabel } from '@/components/cockpit';
import { TreemapNode } from './TreemapNode';

export interface DisasterTreemapItem {
  jpType: string;
  enumType: string;
  scenarios: Scenario[];
  scaleScore: number;
  /** 言及だけで本編にシナリオ記載が無い種別を 1 タイルにまとめた束 */
  bundle?: string[];
}

const BUNDLE_KEY = '__info_bundle__';

const SEVERITY_KEYWORD_WEIGHT: { keyword: RegExp; weight: number }[] = [
  { keyword: /M\s*9|マグニチュード\s*9/i, weight: 8 },
  { keyword: /M\s*8|マグニチュード\s*8/i, weight: 6 },
  { keyword: /M\s*7|マグニチュード\s*7/i, weight: 4 },
  { keyword: /震度7|甚大|壊滅/, weight: 8 },
  { keyword: /震度6/, weight: 5 },
  { keyword: /最大クラス|広域|広範囲|多大/, weight: 4 },
];

function scoreScenarios(scenarios: Scenario[]): number {
  if (!scenarios.length) return 0;
  let max = 1; // base for non-empty
  for (const s of scenarios) {
    const text = `${s.scale} ${s.expected_damage}`;
    for (const rule of SEVERITY_KEYWORD_WEIGHT) {
      if (rule.keyword.test(text) && rule.weight > max) max = rule.weight;
    }
  }
  return max + Math.min(scenarios.length, 5) * 0.5;
}

interface DisasterTreemapProps {
  assessment: DisasterAssessment;
  onSelect?: (jpType: string, enumType: string) => void;
  selectedJpType?: string | null;
}

export function DisasterTreemap({ assessment, onSelect, selectedJpType }: DisasterTreemapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  // ResizeObserver でコンテナサイズ追従
  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const ro = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect();
      setSize({ w: rect.width, h: rect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const items: DisasterTreemapItem[] = useMemo(() => {
    const active = assessment.by_disaster_type
      .filter((d) => d.scenarios.length > 0)
      .map((d) => ({
        jpType: d.disaster_type,
        enumType: disasterJpToEnum(d.disaster_type),
        scenarios: d.scenarios,
        scaleScore: scoreScenarios(d.scenarios),
      }))
      .sort((a, b) => b.scaleScore - a.scaleScore);

    const mentionedOnly = assessment.by_disaster_type
      .filter((d) => d.scenarios.length === 0)
      .map((d) => d.disaster_type);

    if (mentionedOnly.length === 0) return active;

    const bundle: DisasterTreemapItem = {
      jpType: '別資料で要確認',
      enumType: BUNDLE_KEY,
      scenarios: [],
      scaleScore: 0,
      bundle: mentionedOnly,
    };
    return [...active, bundle];
  }, [assessment]);

  const layoutInput: TreemapInput<DisasterTreemapItem>[] = useMemo(
    () =>
      items.map((it) => ({
        id: it.bundle ? BUNDLE_KEY : it.jpType,
        // bundle (言及のみ束) は控えめサイズで表示
        weight: it.bundle ? 1 : Math.max(0.5, it.scaleScore),
        payload: it,
      })),
    [items],
  );

  const rects = useMemo(
    () => computeTreemap(layoutInput, size.w, size.h, 6),
    [layoutInput, size.w, size.h],
  );

  if (!items.length) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <MonoLabel size="xs" tone="dim">
          想定された災害がありません
        </MonoLabel>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative h-full w-full">
      {size.w > 0 && size.h > 0 && (
        <svg width={size.w} height={size.h} className="block">
          {rects.map((r, i) => {
            const it = r.payload;
            const scenarios = it.scenarios.map((s) => ({
              name: isMeaningful(s.name) ? s.name : undefined,
              scale: isMeaningful(s.scale) ? s.scale : undefined,
              expected_damage: isMeaningful(s.expected_damage) ? s.expected_damage : undefined,
            }));
            const isBundle = !!it.bundle;
            return (
              <TreemapNode
                key={r.id}
                x={r.x}
                y={r.y}
                width={r.width}
                height={r.height}
                jaLabel={it.jpType}
                scenarios={scenarios}
                tone={disasterTone(it.jpType)}
                isSelected={!isBundle && selectedJpType === it.jpType}
                onClick={!isBundle && onSelect ? () => onSelect(it.jpType, it.enumType) : undefined}
                delay={i * 0.04}
                infoOnly={isBundle}
                bundleLabels={it.bundle}
              />
            );
          })}
        </svg>
      )}
    </div>
  );
}
