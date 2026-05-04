'use client';

import { useResearchStore } from '@/stores/useResearchStore';
import type { SonaePhase as Phase } from '@/lib/sonae';
import { MonoLabel, StatusDot } from '@/components/cockpit';
import { cn } from '@/lib/utils';

const PHASE_LABELS: { phase: Phase; label: string }[] = [
  { phase: 'discovery', label: 'PDF探索' },
  { phase: 'retrieval', label: 'PDF取得' },
  { phase: 'toc', label: '目次解析' },
  { phase: 'ocr_section', label: 'OCR処理' },
  { phase: 'extract', label: 'AI解析' },
];

export function PhaseStepIndicator() {
  const phases = useResearchStore((s) => s.phases);
  const currentPhase = useResearchStore((s) => s.currentPhase);
  const status = useResearchStore((s) => s.status);

  return (
    <div className="flex items-center gap-1 w-full">
      {PHASE_LABELS.map((p, i) => {
        const ph = phases[p.phase];
        const isActive = currentPhase === p.phase;
        const isDone = ph.status === 'done';
        const isError = status === 'error' && isActive;
        const dotStatus = isError
          ? 'error'
          : isDone
            ? 'done'
            : isActive && status === 'running'
              ? 'running'
              : 'idle';

        return (
          <div key={p.phase} className="flex flex-1 items-center gap-2">
            <div
              className={cn(
                'flex flex-1 flex-col items-start gap-1 border-hairline border-hairline px-2 py-1.5 rounded-cockpit transition-colors relative overflow-hidden',
                isActive && status === 'running' && 'border-accent bg-accent-soft',
                isDone && 'border-accent/40',
              )}
            >
              {/* CRT scan sweep on active */}
              {isActive && status === 'running' && (
                <span className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-transparent via-accent/30 to-transparent animate-sweep" />
              )}
              <div className="flex items-center gap-1.5 relative">
                <StatusDot status={dotStatus} />
                <MonoLabel size="2xs" tone="dim">
                  {String(i + 1).padStart(2, '0')}
                </MonoLabel>
              </div>
              <MonoLabel
                size="2xs"
                tone={isDone || isActive ? 'default' : 'dim'}
                className="relative"
              >
                {p.label}
              </MonoLabel>
            </div>
            {i < PHASE_LABELS.length - 1 && (
              <span className="text-ink-dim text-xs select-none">›</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
