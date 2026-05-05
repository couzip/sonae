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
}

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
  onSelect: (jpType: string, enumType: string) => void;
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
    return assessment.by_disaster_type
      .filter((d) => d.scenarios.length > 0)
      .map((d) => ({
        jpType: d.disaster_type,
        enumType: disasterJpToEnum(d.disaster_type),
        scenarios: d.scenarios,
        scaleScore: scoreScenarios(d.scenarios),
      }))
      .sort((a, b) => b.scaleScore - a.scaleScore);
  }, [assessment]);

  const layoutInput: TreemapInput<DisasterTreemapItem>[] = useMemo(
    () =>
      items.map((it) => ({
        id: it.jpType,
        weight: Math.max(0.5, it.scaleScore),
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
            }));
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
                isSelected={selectedJpType === it.jpType}
                onClick={() => onSelect(it.jpType, it.enumType)}
                delay={i * 0.04}
              />
            );
          })}
        </svg>
      )}
    </div>
  );
}
