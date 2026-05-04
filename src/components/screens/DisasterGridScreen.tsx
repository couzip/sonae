'use client';

import { useFlowStore } from '@/stores/useFlowStore';
import { useResearchStore } from '@/stores/useResearchStore';
import { useLocationStore } from '@/stores/useLocationStore';
import { HUDFrame, MonoLabel } from '@/components/cockpit';
import { DisasterTreemap } from '@/components/treemap/DisasterTreemap';
import { TreemapLegend } from '@/components/treemap/TreemapLegend';

export function DisasterGridScreen() {
  const openDisaster = useFlowStore((s) => s.openDisaster);
  const setPhase = useFlowStore((s) => s.setPhase);
  const result = useResearchStore((s) => s.result);
  const municipality = useLocationStore((s) => s.municipality);

  if (!result) {
    return (
      <HUDFrame
        serial="SONAE / SCN-03"
        title="災害グリッド"
        rightSlot={
          <MonoLabel size="2xs" tone="dim">
            PHASE 3 / 5
          </MonoLabel>
        }
        className="h-full"
        bodyClassName="flex items-center justify-center p-6"
      >
        <div className="flex flex-col items-center gap-3">
          <MonoLabel size="xs" tone="dim">
            解析結果がありません
          </MonoLabel>
          <button
            type="button"
            onClick={() => setPhase('research')}
            className="border-hairline border-hairline px-3 py-1.5 rounded-cockpit hover:border-accent transition-colors"
          >
            <MonoLabel size="xs" tone="default">
              ◀ リサーチへ
            </MonoLabel>
          </button>
        </div>
      </HUDFrame>
    );
  }

  const totalScenarios = result.by_disaster_type.reduce((sum, d) => sum + d.scenarios.length, 0);
  const activeTypes = result.by_disaster_type.filter((d) => d.scenarios.length > 0).length;

  return (
    <HUDFrame
      serial="SONAE / SCN-03"
      title="災害グリッド"
      rightSlot={
        <MonoLabel size="2xs" tone="dim">
          PHASE 3 / 5
        </MonoLabel>
      }
      className="h-full"
      bodyClassName="flex flex-col gap-3 p-4"
    >
      <header className="flex items-end justify-between">
        <div>
          <h2 className="font-sans text-lg text-ink leading-tight">
            {municipality?.prefecture} {municipality?.name}
          </h2>
          <MonoLabel size="2xs" tone="mute">
            想定される事象 — クリックで詳細・対策一覧
          </MonoLabel>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-baseline gap-1">
            <MonoLabel size="2xs" tone="dim">
              DISASTERS
            </MonoLabel>
            <span className="font-mono tabular-nums text-mono-base text-ink">
              {String(activeTypes).padStart(2, '0')}
            </span>
          </div>
          <div className="flex items-baseline gap-1">
            <MonoLabel size="2xs" tone="dim">
              SCENARIOS
            </MonoLabel>
            <span className="font-mono tabular-nums text-mono-base text-ink">
              {String(totalScenarios).padStart(3, '0')}
            </span>
          </div>
        </div>
      </header>

      <div className="flex-1 corner-tick relative border-hairline border-hairline-strong rounded-cockpit overflow-hidden">
        <DisasterTreemap
          assessment={result}
          onSelect={(jpType, enumType) => openDisaster({ jpType, enumType })}
        />
      </div>

      <footer className="flex items-center justify-between">
        <TreemapLegend />
        {result.source?.pdf_label && (
          <MonoLabel size="2xs" tone="dim" uppercase={false}>
            出典: {result.source.pdf_label}
          </MonoLabel>
        )}
      </footer>
    </HUDFrame>
  );
}
