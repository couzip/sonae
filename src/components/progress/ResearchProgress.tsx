'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useResearchStore } from '@/stores/useResearchStore';
import { PhaseStepIndicator } from './PhaseStepIndicator';

const PHASE_HEADLINE: Record<string, string> = {
  discovery: '情報源を探しています',
  retrieval: '情報を取得しています',
  toc: '内容を確認しています',
  ocr_scan: '本文を読み取っています',
  ocr_section: '本文を読み取っています',
  extract: '情報を整理しています',
};

function fmtTime(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

export function ResearchProgress() {
  const status = useResearchStore((s) => s.status);
  const currentPhase = useResearchStore((s) => s.currentPhase);
  const logs = useResearchStore((s) => s.logs);
  const [dotCount, setDotCount] = useState(1);
  const tailRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (status !== 'running') return;
    const t = setInterval(() => setDotCount((c) => (c % 3) + 1), 500);
    return () => clearInterval(t);
  }, [status]);

  useEffect(() => {
    tailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [logs.length]);

  const headline =
    status === 'done' || status === 'cache_hit'
      ? '完了しました'
      : status === 'error'
        ? '取得に失敗しました'
        : (currentPhase && PHASE_HEADLINE[currentPhase]) ?? '情報を収集しています';

  const dots = '.'.repeat(dotCount);
  const recentLogs = logs.slice(-200);

  return (
    <div className="flex flex-col gap-4 w-full min-h-0">
      <div className="flex items-center gap-3">
        {status === 'running' && (
          <Loader2 className="h-5 w-5 animate-spin text-accent shrink-0" aria-hidden />
        )}
        <h3 className="font-sans text-lg text-ink leading-tight">
          {headline}
          {status === 'running' && (
            <span className="text-accent/70 inline-block w-6 text-left">{dots}</span>
          )}
        </h3>
      </div>
      <PhaseStepIndicator />
      <div className="flex-1 border-hairline border-hairline rounded-cockpit bg-bg-sunken/60 p-3 overflow-auto min-h-0 max-h-72">
        {recentLogs.length === 0 ? (
          <p className="text-xs text-ink-dim">起動中…</p>
        ) : (
          <ul className="flex flex-col gap-0.5 font-mono text-xs">
            {recentLogs.map((l, i) => (
              <li
                key={i}
                className={
                  l.tone === 'error'
                    ? 'text-scale-lg break-all'
                    : 'text-ink-mute break-all'
                }
              >
                <span className="text-ink-dim mr-2 tabular-nums">{fmtTime(l.ts)}</span>
                {l.message}
              </li>
            ))}
            <div ref={tailRef} />
          </ul>
        )}
      </div>
    </div>
  );
}
