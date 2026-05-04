'use client';

import { cn } from '@/lib/utils';
import type { ChecklistItemState } from '@/stores/useChecklistStore';

interface TriStateToggleProps {
  value: ChecklistItemState;
  onChange: (next: ChecklistItemState) => void;
  className?: string;
}

const CYCLE: ChecklistItemState[] = ['unanswered', 'done', 'pending', 'na'];

const CELL_CONFIG: Record<
  Exclude<ChecklistItemState, 'unanswered'>,
  { glyph: string; label: string; toneClass: string }
> = {
  done: { glyph: '✓', label: 'できている', toneClass: 'text-accent' },
  pending: { glyph: '—', label: 'まだ', toneClass: 'text-ink' },
  na: { glyph: '/', label: '該当なし', toneClass: 'text-ink-mute' },
};

export function TriStateToggle({ value, onChange, className }: TriStateToggleProps) {
  // キーボード: Tab で focus、1/2/3 で done/pending/na、0 で unanswered
  const handleKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === '1') onChange('done');
    else if (e.key === '2') onChange('pending');
    else if (e.key === '3') onChange('na');
    else if (e.key === '0') onChange('unanswered');
    else if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      const idx = CYCLE.indexOf(value);
      onChange(CYCLE[(idx + 1) % CYCLE.length]);
    }
  };

  return (
    <div
      role="radiogroup"
      tabIndex={0}
      onKeyDown={handleKey}
      className={cn(
        'inline-flex items-center gap-0 border-hairline border-hairline rounded-cockpit overflow-hidden focus:border-accent focus:outline-none',
        className,
      )}
    >
      {(['done', 'pending', 'na'] as const).map((s) => {
        const isActive = value === s;
        const cfg = CELL_CONFIG[s];
        return (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={isActive}
            aria-label={cfg.label}
            onClick={() => onChange(isActive ? 'unanswered' : s)}
            className={cn(
              'h-7 w-7 flex items-center justify-center font-mono text-mono-sm transition-colors',
              isActive ? cfg.toneClass + ' bg-bg-raised' : 'text-ink-dim hover:text-ink-mute',
              s !== 'done' && 'border-l-hairline border-hairline',
            )}
            title={cfg.label}
          >
            {isActive ? cfg.glyph : '·'}
          </button>
        );
      })}
    </div>
  );
}
