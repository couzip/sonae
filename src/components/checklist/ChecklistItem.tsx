'use client';

import { useMemo, useState } from 'react';
import type { Countermeasure } from '@/lib/sonae/client/countermeasures-filter';
import { useChecklistStore } from '@/stores/useChecklistStore';
import { useResearchStore } from '@/stores/useResearchStore';
import { SourceLink } from '@/components/cockpit';
import {
  disasterEnumToJp,
  disasterJpToEnum,
} from '@/lib/sonae/client/disaster-mapping';
import { disasterTone } from '@/lib/sonae/client/disaster-style';
import { TriStateToggle } from './TriStateToggle';

interface ChecklistItemProps {
  item: Countermeasure;
  municipalityCode: string;
}

const EFFORT_LABEL: Record<'low' | 'medium' | 'high', string> = {
  low: '軽',
  medium: '中',
  high: '重',
};

export function ChecklistItem({ item, municipalityCode }: ChecklistItemProps) {
  const [expanded, setExpanded] = useState(false);
  const value = useChecklistStore((s) => s.items[`${municipalityCode}:${item.id}`] ?? 'unanswered');
  const setVal = useChecklistStore((s) => s.set);
  const result = useResearchStore((s) => s.result);

  const detectedEnums = useMemo(() => {
    const set = new Set<string>();
    for (const d of result?.by_disaster_type ?? []) {
      if (d.scenarios.length === 0) continue;
      set.add(disasterJpToEnum(d.disaster_type));
    }
    return set;
  }, [result]);

  const isCommon =
    item.disaster_group === 'common' || item.applicable_disasters.includes('common');
  const labels = isCommon
    ? ['共通']
    : item.applicable_disasters
        .filter((e) => detectedEnums.has(e))
        .map((e) => disasterEnumToJp(e));

  return (
    <li className="border-hairline border-hairline rounded-cockpit hover:border-ink-mute transition-colors">
      <div className="flex items-center gap-3 p-2">
        <TriStateToggle
          value={value}
          onChange={(next) => setVal(municipalityCode, item.id, next)}
        />
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex-1 text-left flex flex-col gap-1 min-w-0"
        >
          <span className="font-sans text-sm text-ink">{item.label}</span>
          {labels.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              {labels.map((jp) => {
                const tone = disasterTone(jp);
                return (
                  <span
                    key={jp}
                    className="inline-flex items-center px-1.5 py-0.5 rounded-cockpit border text-xs leading-none"
                    style={{
                      backgroundColor: tone.fill,
                      borderColor: tone.border,
                      color: tone.text,
                    }}
                  >
                    {jp}
                  </span>
                );
              })}
            </div>
          )}
        </button>
        <span className="text-xs text-ink-mute whitespace-nowrap">
          {EFFORT_LABEL[item.effort.time]}・{EFFORT_LABEL[item.effort.cost]}
        </span>
      </div>
      {expanded && (
        <div className="border-t-hairline border-hairline px-3 pb-3 pt-2 bg-bg-sunken/40 space-y-2">
          {item.short_description && (
            <p className="text-xs text-ink leading-relaxed">{item.short_description}</p>
          )}
          {item.detail?.why && (
            <div>
              <div className="text-xs text-ink-dim mb-0.5">なぜ</div>
              <p className="text-xs text-ink-mute leading-relaxed">{item.detail.why}</p>
            </div>
          )}
          {item.detail?.how && (
            <div>
              <div className="text-xs text-ink-dim mb-0.5">どう進めるか</div>
              <p className="text-xs text-ink-mute leading-relaxed">{item.detail.how}</p>
            </div>
          )}
          {item.detail?.references && item.detail.references.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-ink-dim">出典</span>
              {item.detail.references.map((r, i) => (
                <SourceLink key={i} index={i + 1} title={r.title} url={r.url ?? null} />
              ))}
            </div>
          )}
        </div>
      )}
    </li>
  );
}
