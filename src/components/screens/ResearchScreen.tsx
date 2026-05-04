'use client';

import { useEffect } from 'react';
import { useFlowStore } from '@/stores/useFlowStore';
import { useLocationStore } from '@/stores/useLocationStore';
import { useResearchStore } from '@/stores/useResearchStore';
import MapBaseClient from '@/components/map/MapBase';
import { ResearchProgress } from '@/components/progress/ResearchProgress';
import { BuildingForm } from '@/components/profile/BuildingForm';
import { HUDFrame, MonoLabel, HairlineDivider } from '@/components/cockpit';

export function ResearchScreen() {
  const setPhase = useFlowStore((s) => s.setPhase);
  const municipality = useLocationStore((s) => s.municipality);
  const picked = useLocationStore((s) => s.picked);
  const start = useResearchStore((s) => s.start);
  const status = useResearchStore((s) => s.status);
  const error = useResearchStore((s) => s.error);

  // 場所が決まっていなければ pick へ戻す
  useEffect(() => {
    if (!municipality) {
      setPhase('pick');
      return;
    }
    // SSE 開始 (idle 状態のみ)
    if (status === 'idle') {
      start(municipality.code);
    }
  }, [municipality, status, start, setPhase]);

  // 完了時に grid へ自動遷移
  useEffect(() => {
    if (status === 'done' || status === 'cache_hit') {
      const t = setTimeout(() => setPhase('grid'), 800);
      return () => clearTimeout(t);
    }
  }, [status, setPhase]);

  if (!municipality) return null;

  return (
    <div className="relative h-full w-full bg-bg">
      <MapBaseClient
        center={picked ? [picked.lng, picked.lat] : undefined}
        pin={picked}
        className="absolute inset-0 opacity-50"
        interactive={false}
      />

      {/* darken overlay */}
      <div className="absolute inset-0 bg-bg/70 backdrop-blur-sm pointer-events-none" />

      <div className="relative z-10 grid h-full grid-cols-1 lg:grid-cols-[1fr_360px] gap-4 p-4">
        {/* Main: progress */}
        <HUDFrame
          serial="SONAE / SCN-02"
          title="リサーチ"
          rightSlot={
            <MonoLabel size="2xs" tone="dim">
              PHASE 2 / 5
            </MonoLabel>
          }
          className="overflow-hidden"
          bodyClassName="p-4"
        >
          <div className="flex flex-col gap-4 h-full">
            <header className="flex items-baseline justify-between">
              <div>
                <h2 className="font-sans text-lg text-ink leading-tight">
                  {municipality.prefecture} {municipality.name}
                </h2>
                <MonoLabel size="2xs" tone="mute">
                  CODE {municipality.code} · 地域防災計画 PDF を解析中
                </MonoLabel>
              </div>
            </header>

            <HairlineDivider variant="dashed" />

            <ResearchProgress />

            {error && (
              <div className="border-hairline border-scale-lg bg-bg-raised/50 p-3 rounded-cockpit">
                <MonoLabel size="2xs" tone="default" className="text-scale-lg">
                  ⚠ ERROR
                </MonoLabel>
                <p className="font-sans text-sm text-ink mt-1">{error}</p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => start(municipality.code)}
                    className="border-hairline border-hairline px-3 py-1 rounded-cockpit hover:border-accent transition-colors"
                  >
                    <MonoLabel size="2xs" tone="default">
                      ▶ 再試行
                    </MonoLabel>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPhase('pick')}
                    className="border-hairline border-hairline px-3 py-1 rounded-cockpit hover:border-accent transition-colors"
                  >
                    <MonoLabel size="2xs" tone="mute">
                      ◀ 場所を変える
                    </MonoLabel>
                  </button>
                </div>
              </div>
            )}

            {(status === 'done' || status === 'cache_hit') && (
              <div className="border-hairline border-accent bg-accent-soft p-3 rounded-cockpit">
                <MonoLabel size="2xs" tone="accent">
                  PIPELINE COMPLETE
                </MonoLabel>
                <p className="font-sans text-sm text-ink mt-1">災害グリッドへ遷移中…</p>
              </div>
            )}
          </div>
        </HUDFrame>

        {/* Side: profile form */}
        <HUDFrame
          serial="SONAE / SCN-02b"
          title="建物プロファイル"
          className="overflow-hidden hidden lg:flex"
          bodyClassName="p-4"
        >
          <BuildingForm />
        </HUDFrame>
      </div>
    </div>
  );
}
