'use client';

import { useEffect, useState } from 'react';
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

export function ResearchProgress() {
  const status = useResearchStore((s) => s.status);
  const currentPhase = useResearchStore((s) => s.currentPhase);
  const [dotCount, setDotCount] = useState(1);

  useEffect(() => {
    if (status !== 'running') return;
    const t = setInterval(() => setDotCount((c) => (c % 3) + 1), 500);
    return () => clearInterval(t);
  }, [status]);

  const headline =
    status === 'done' || status === 'cache_hit'
      ? '完了しました'
      : status === 'error'
        ? '取得に失敗しました'
        : (currentPhase && PHASE_HEADLINE[currentPhase]) ?? '情報を収集しています';

  const dots = '.'.repeat(dotCount);

  return (
    <div className="flex flex-col gap-4 w-full">
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
    </div>
  );
}
