'use client';

import { useEffect, useRef } from 'react';
import { useResearchStore } from '@/stores/useResearchStore';
import { MonoLabel } from '@/components/cockpit';
import { cn } from '@/lib/utils';

export function LogTicker({
  className,
  maxHeight = 280,
}: {
  className?: string;
  maxHeight?: number;
}) {
  const logs = useResearchStore((s) => s.logs);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.scrollTop = ref.current.scrollHeight;
    }
  }, [logs.length]);

  return (
    <div
      ref={ref}
      className={cn(
        'corner-tick border-hairline border-hairline-strong bg-bg-sunken/90 rounded-cockpit p-3 overflow-auto font-mono',
        className,
      )}
      style={{ maxHeight }}
    >
      {logs.length === 0 ? (
        <MonoLabel size="2xs" tone="dim">
          NO EVENTS YET
        </MonoLabel>
      ) : (
        <ul className="space-y-0.5">
          {logs.map((l, i) => (
            <li key={i} className="flex gap-2 items-start">
              <span className="text-mono-2xs tabular-nums text-ink-dim shrink-0">
                {formatTs(l.ts)}
              </span>
              {l.phase && (
                <span className="text-mono-2xs uppercase tracking-cockpit text-accent/70 shrink-0">
                  {l.phase}
                </span>
              )}
              <span
                className={cn(
                  'text-mono-xs whitespace-pre-wrap break-all',
                  l.tone === 'error' ? 'text-scale-lg' : 'text-ink',
                )}
              >
                {l.message}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function formatTs(ts: number): string {
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
function pad(n: number): string {
  return String(n).padStart(2, '0');
}
