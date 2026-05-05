'use client';

import { MapPin } from 'lucide-react';
import { useFlowStore } from '@/stores/useFlowStore';
import { useResearchStore } from '@/stores/useResearchStore';
import { useLocationStore } from '@/stores/useLocationStore';
import { HUDFrame } from '@/components/cockpit';
import { DisasterTreemap } from '@/components/treemap/DisasterTreemap';
import { TreemapLegend } from '@/components/treemap/TreemapLegend';
import { DisasterDetailPanel } from './DisasterDetailPanel';

export function DisasterGridScreen() {
  const setPhase = useFlowStore((s) => s.setPhase);
  const result = useResearchStore((s) => s.result);
  const municipality = useLocationStore((s) => s.municipality);

  if (!result) {
    return (
      <div className="relative h-full w-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-sm text-ink-mute bg-bg-sunken/85 backdrop-blur p-4 rounded-cockpit border-hairline border-hairline">
          <span>解析結果がまだありません</span>
          <button
            type="button"
            onClick={() => setPhase('research')}
            className="border-hairline border-hairline px-3 py-1.5 rounded-cockpit hover:border-accent transition-colors text-ink"
          >
            解析を開始する
          </button>
        </div>
      </div>
    );
  }

  const totalScenarios = result.by_disaster_type.reduce((sum, d) => sum + d.scenarios.length, 0);
  const activeTypes = result.by_disaster_type.filter((d) => d.scenarios.length > 0).length;

  return (
    <div className="relative h-full w-full">
      <div className="absolute inset-0 bg-bg/55 pointer-events-none" />

      <div className="relative z-10 h-full p-4 grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-4 min-h-0">
        <HUDFrame
          title="想定される災害"
          rightSlot={
            <div className="flex items-center gap-3 text-xs text-ink-mute tabular-nums">
              <span>
                種別 <span className="text-ink">{activeTypes}</span>
              </span>
              <span>
                シナリオ <span className="text-ink">{totalScenarios}</span>
              </span>
              <button
                type="button"
                onClick={() => setPhase('pick')}
                className="inline-flex items-center gap-1.5 border-hairline border-accent bg-accent-soft hover:bg-accent-dim px-3 py-1.5 rounded-cockpit text-accent transition-colors"
              >
                <MapPin className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                場所を変える
              </button>
            </div>
          }
          className="h-full min-h-0"
          bodyClassName="flex flex-col gap-3 p-4 min-h-0"
        >
          <header>
            <h3 className="font-sans text-lg text-ink leading-tight">
              {municipality?.prefecture} {municipality?.name}
            </h3>
          </header>

          <div className="flex-1 relative border-hairline border-hairline rounded-cockpit overflow-hidden bg-bg-sunken/60 min-h-0">
            <DisasterTreemap assessment={result} />
          </div>

          <footer className="flex items-center justify-between gap-3 flex-wrap">
            <TreemapLegend
              types={result.by_disaster_type
                .filter((d) => d.scenarios.length > 0)
                .map((d) => d.disaster_type)}
            />
            {result.source?.pdf_label && (
              <span className="text-xs text-ink-dim">出典: {result.source.pdf_label}</span>
            )}
          </footer>
        </HUDFrame>

        <div className="min-h-0 h-full">
          <DisasterDetailPanel />
        </div>
      </div>
    </div>
  );
}
