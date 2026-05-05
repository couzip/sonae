'use client';

import { Check, Minus } from 'lucide-react';

interface Props {
  ok: boolean;
  label?: string;
}

export function StatusBadge({ ok, label }: Props) {
  if (ok) {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-cockpit bg-accent-soft text-accent text-xs">
        <Check className="h-3 w-3" strokeWidth={2} aria-hidden />
        {label ?? 'あり'}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-cockpit bg-bg-sunken text-ink-dim text-xs">
      <Minus className="h-3 w-3" strokeWidth={2} aria-hidden />
      {label ?? 'なし'}
    </span>
  );
}
