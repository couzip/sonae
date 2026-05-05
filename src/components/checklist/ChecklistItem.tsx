'use client';

import { useState } from 'react';
import type { Countermeasure } from '@/lib/sonae/client/countermeasures-filter';
import { useChecklistStore } from '@/stores/useChecklistStore';
import { SourceLink } from '@/components/cockpit';
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
          className="flex-1 text-left"
        >
          <span className="font-sans text-sm text-ink">{item.label}</span>
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
