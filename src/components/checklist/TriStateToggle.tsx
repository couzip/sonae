'use client';

import { cn } from '@/lib/utils';
import type { ChecklistItemState } from '@/stores/useChecklistStore';

interface TriStateToggleProps {
  value: ChecklistItemState;
  onChange: (next: ChecklistItemState) => void;
  className?: string;
}

type Cell = Exclude<ChecklistItemState, 'unanswered'>;

const CELLS: { value: Cell; label: string; activeClass: string; inactiveClass: string }[] = [
  {
    value: 'done',
    label: 'できた',
    activeClass: 'bg-accent text-bg',
    inactiveClass: 'text-ink-mute hover:text-ink hover:bg-bg-raised',
  },
  {
    value: 'pending',
    label: 'まだ',
    activeClass: 'bg-ink-mute/40 text-ink',
    inactiveClass: 'text-ink-mute hover:text-ink hover:bg-bg-raised',
  },
  {
    value: 'na',
    label: '不要',
    activeClass: 'bg-ink-dim/40 text-ink-mute',
    inactiveClass: 'text-ink-dim hover:text-ink-mute hover:bg-bg-raised',
  },
];

export function TriStateToggle({ value, onChange, className }: TriStateToggleProps) {
  return (
    <div
      role="radiogroup"
      className={cn(
        'inline-flex items-stretch border-hairline border-hairline rounded-cockpit overflow-hidden',
        className,
      )}
    >
      {CELLS.map((c, i) => {
        const isActive = value === c.value;
        return (
          <button
            key={c.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            aria-label={c.label}
            onClick={() => onChange(isActive ? 'unanswered' : c.value)}
            className={cn(
              'h-7 px-3 flex items-center justify-center text-xs leading-none transition-colors',
              isActive ? c.activeClass : c.inactiveClass,
              i > 0 && 'border-l-hairline border-hairline',
            )}
          >
            {c.label}
          </button>
        );
      })}
    </div>
  );
}
