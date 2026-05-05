'use client';

import { useEffect } from 'react';
import { useFlowStore } from '@/stores/useFlowStore';
import { useLocationStore } from '@/stores/useLocationStore';
import { useResearchStore } from '@/stores/useResearchStore';
import { ResearchProgress } from '@/components/progress/ResearchProgress';
import { BuildingForm } from '@/components/profile/BuildingForm';
import { HUDFrame, HairlineDivider } from '@/components/cockpit';

export function ResearchScreen() {
  const setPhase = useFlowStore((s) => s.setPhase);
  const municipality = useLocationStore((s) => s.municipality);
  const start = useResearchStore((s) => s.start);
  const status = useResearchStore((s) => s.status);
  const error = useResearchStore((s) => s.error);
  const lastCode = useResearchStore((s) => s.code);

  useEffect(() => {
    if (!municipality) return;
    if (status === 'running') return;
    if (lastCode !== municipality.code || status === 'idle') {
      start(municipality.code, { name: municipality.name, prefecture: municipality.prefecture });
    }
  }, [municipality, status, start, lastCode]);

  useEffect(() => {
    if (status === 'done' || status === 'cache_hit') {
      const t = setTimeout(() => setPhase('grid'), 800);
      return () => clearTimeout(t);
    }
  }, [status, setPhase]);

  if (!municipality) {
    return (
      <div className="relative h-full w-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-sm text-ink-mute bg-bg-sunken/85 backdrop-blur p-4 rounded-cockpit border-hairline border-hairline">
          <span>場所情報を読み込んでいます</span>
          <button
            type="button"
            onClick={() => setPhase('pick')}
            className="border-hairline border-hairline px-3 py-1.5 rounded-cockpit hover:border-accent transition-colors text-ink"
          >
            場所選択に戻る
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <div className="absolute inset-0 bg-bg/55 pointer-events-none" />

      <div className="relative z-10 grid h-full grid-cols-1 lg:grid-cols-[1fr_360px] gap-4 p-4">
        <HUDFrame title="情報を収集中" className="overflow-hidden" bodyClassName="p-4">
          <div className="flex flex-col gap-4 h-full">
            <header>
              <h2 className="font-sans text-lg text-ink leading-tight">
                {municipality.prefecture} {municipality.name}
              </h2>
              <p className="text-xs text-ink-mute mt-0.5">
                公的な情報源から災害情報を収集しています
              </p>
            </header>

            <HairlineDivider variant="dashed" />

            <ResearchProgress />

            {error && (
              <div className="border-hairline border-scale-lg bg-bg-raised/50 p-3 rounded-cockpit">
                <div className="text-sm text-scale-lg">{error}</div>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => start(municipality.code, { name: municipality.name, prefecture: municipality.prefecture })}
                    className="border-hairline border-hairline px-3 py-1 rounded-cockpit hover:border-accent transition-colors text-xs text-ink"
                  >
                    再試行
                  </button>
                  <button
                    type="button"
                    onClick={() => setPhase('pick')}
                    className="border-hairline border-hairline px-3 py-1 rounded-cockpit hover:border-accent transition-colors text-xs text-ink-mute"
                  >
                    場所を変える
                  </button>
                </div>
              </div>
            )}

            {(status === 'done' || status === 'cache_hit') && (
              <div className="border-hairline border-accent bg-accent-soft p-3 rounded-cockpit text-sm text-ink">
                完了しました。災害一覧へ移動します。
              </div>
            )}
          </div>
        </HUDFrame>

        <HUDFrame title="建物の情報" className="overflow-hidden hidden lg:flex" bodyClassName="p-4">
          <BuildingForm />
        </HUDFrame>
      </div>
    </div>
  );
}
