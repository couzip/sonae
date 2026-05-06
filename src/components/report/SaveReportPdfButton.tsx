'use client';

import { useRef, useState } from 'react';
import { useLocationStore } from '@/stores/useLocationStore';
import { useResearchStore } from '@/stores/useResearchStore';
import { useChecklistStore } from '@/stores/useChecklistStore';
import { useRecommendationsStore } from '@/stores/useRecommendationsStore';
import type { Countermeasure } from '@/lib/sonae/client/countermeasures-filter';
import { PrintReport } from './PrintReport';
import { generateReportPdf } from './generatePdf';

export function SaveReportPdfButton() {
  const municipality = useLocationStore((s) => s.municipality);
  const result = useResearchStore((s) => s.result);
  const items = useChecklistStore((s) => s.items);
  const nextActions = useRecommendationsStore((s) => s.result);

  const reportRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countermeasures, setCountermeasures] = useState<Countermeasure[] | null>(null);

  const handleClick = async () => {
    if (!municipality || !result) {
      setError('レポート生成に必要なデータが揃っていません');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      let cms = countermeasures;
      if (!cms) {
        const r = await fetch(`/api/checklist?code=${encodeURIComponent(municipality.code)}`);
        if (!r.ok) throw new Error(`countermeasures HTTP ${r.status}`);
        const data = await r.json();
        cms = data.items as Countermeasure[];
        setCountermeasures(cms);
      }
      // ref が描画されるまで 1tick 待つ
      await new Promise((res) => requestAnimationFrame(() => res(null)));
      const el = reportRef.current;
      if (!el) throw new Error('レポート要素が見つかりません');
      const filename = `sonae_${municipality.code}_${new Date().toISOString().slice(0, 10)}.pdf`;
      await generateReportPdf(el, filename);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`PDF 生成に失敗しました: ${msg}`);
    } finally {
      setBusy(false);
    }
  };

  if (!municipality || !result) return null;

  return (
    <>
      <div className="flex flex-col items-end gap-1">
        <button
          type="button"
          disabled={busy}
          onClick={handleClick}
          className="border-hairline border-accent bg-accent-soft hover:bg-accent-dim disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded-cockpit transition-colors text-sm text-accent"
        >
          {busy ? '生成中…' : 'PDF として保存'}
        </button>
        {error && <span className="text-xs text-scale-lg">{error}</span>}
      </div>
      {countermeasures && (
        <PrintReport
          ref={reportRef}
          municipality={municipality}
          result={result}
          nextActions={nextActions}
          countermeasures={countermeasures}
          checklistState={items}
        />
      )}
    </>
  );
}
