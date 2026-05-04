'use client';

import { useState } from 'react';
import type { Countermeasure } from '@/lib/sonae/client/countermeasures-filter';
import { useChecklistStore } from '@/stores/useChecklistStore';
import { MonoLabel, SourceLink } from '@/components/cockpit';
import { TriStateToggle } from './TriStateToggle';

interface ChecklistItemProps {
  item: Countermeasure;
  municipalityCode: string;
}

const EFFORT_LABEL: Record<'low' | 'medium' | 'high', string> = {
  low: '小',
  medium: '中',
  high: '大',
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
          className="flex flex-1 items-baseline gap-2 text-left"
        >
          <span className="font-sans text-sm text-ink">{item.label}</span>
          <span className="leader-dots" />
          <MonoLabel size="2xs" tone="dim">
            {item.id.toUpperCase()}
          </MonoLabel>
        </button>
        <MonoLabel size="2xs" tone="mute">
          時間 {EFFORT_LABEL[item.effort.time]} ／ 費用 {EFFORT_LABEL[item.effort.cost]}
        </MonoLabel>
      </div>
      {expanded && (
        <div className="border-t-hairline border-hairline px-3 pb-3 pt-2 bg-bg-sunken/40">
          {item.short_description && (
            <p className="font-sans text-xs text-ink leading-relaxed mb-2">
              {item.short_description}
            </p>
          )}
          {item.detail?.why && (
            <div className="mb-2">
              <MonoLabel size="2xs" tone="dim">
                なぜ
              </MonoLabel>
              <p className="font-sans text-xs text-ink-mute leading-relaxed mt-0.5">
                {item.detail.why}
              </p>
            </div>
          )}
          {item.detail?.how && (
            <div className="mb-2">
              <MonoLabel size="2xs" tone="dim">
                どう進めるか
              </MonoLabel>
              <p className="font-sans text-xs text-ink-mute leading-relaxed mt-0.5">
                {item.detail.how}
              </p>
            </div>
          )}
          {item.detail?.references && item.detail.references.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <MonoLabel size="2xs" tone="dim">
                出典
              </MonoLabel>
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
