'use client';

import { useResearchStore } from '@/stores/useResearchStore';
import { MonoLabel } from '@/components/cockpit';
import { PhaseStepIndicator } from './PhaseStepIndicator';
import { LogTicker } from './LogTicker';

export function ResearchProgress() {
  const status = useResearchStore((s) => s.status);
  const code = useResearchStore((s) => s.code);

  return (
    <div className="flex flex-col gap-3 w-full max-w-3xl">
      <header className="flex items-center justify-between">
        <div className="flex items-baseline gap-3">
          <MonoLabel size="2xs" tone="dim">
            PIPELINE STATUS
          </MonoLabel>
          {code && (
            <MonoLabel size="2xs" tone="mute">
              CODE {code}
            </MonoLabel>
          )}
        </div>
        <MonoLabel
          size="2xs"
          tone={status === 'error' ? 'default' : status === 'done' ? 'accent' : 'dim'}
          className={status === 'error' ? 'text-scale-lg' : undefined}
        >
          {statusLabel(status)}
        </MonoLabel>
      </header>

      <PhaseStepIndicator />

      <LogTicker />
    </div>
  );
}

function statusLabel(s: ReturnType<typeof useResearchStore.getState>['status']): string {
  switch (s) {
    case 'idle':
      return 'IDLE';
    case 'running':
      return 'RUNNING';
    case 'done':
      return 'COMPLETE';
    case 'cache_hit':
      return 'CACHE HIT';
    case 'error':
      return 'ERROR';
    default:
      return s;
  }
}
