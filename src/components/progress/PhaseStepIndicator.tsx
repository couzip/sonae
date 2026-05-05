'use client';

import { Loader2 } from 'lucide-react';
import { useResearchStore } from '@/stores/useResearchStore';
import type { SonaePhase as Phase } from '@/lib/sonae';
import { cn } from '@/lib/utils';

const PHASE_LABELS: { phase: Phase; label: string }[] = [
  { phase: 'discovery', label: '情報源を探す' },
  { phase: 'retrieval', label: '情報を取得' },
  { phase: 'toc', label: '内容を確認' },
  { phase: 'ocr_section', label: '本文を読み取り' },
  { phase: 'extract', label: '情報を整理' },
];

export function PhaseStepIndicator() {
  const phases = useResearchStore((s) => s.phases);
  const currentPhase = useResearchStore((s) => s.currentPhase);
  const status = useResearchStore((s) => s.status);

  return (
    <ol className="flex items-center gap-2 w-full flex-wrap">
      {PHASE_LABELS.map((p) => {
        const ph = phases[p.phase];
        const isActive = currentPhase === p.phase;
        const isDone = ph.status === 'done';
        const isError = status === 'error' && isActive;
        const running = status === 'running';

        return (
          <li
            key={p.phase}
            className={cn(
              'flex items-center gap-2 border-hairline border-hairline px-3 py-2 rounded-cockpit transition-colors min-w-0',
              isActive && running && 'border-accent bg-accent-soft/50',
              isDone && !isActive && 'border-accent/40',
              isError && 'border-scale-lg/70 bg-scale-lg/10',
            )}
          >
            <span
              className={cn(
                'h-2 w-2 rounded-full shrink-0',
                isError && 'bg-scale-lg',
                !isError && isDone && 'bg-accent',
                !isError && isActive && running && 'bg-accent animate-pulse',
                !isError && !isDone && !isActive && 'bg-ink-dim',
              )}
            />
            {isActive && running && (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-accent shrink-0" aria-hidden />
            )}
            <span
              className={cn(
                'text-xs font-sans truncate',
                isDone || isActive ? 'text-ink' : 'text-ink-dim',
              )}
            >
              {p.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
