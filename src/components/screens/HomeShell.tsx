'use client';

import { useFlowStore } from '@/stores/useFlowStore';
import { MapHost } from '@/components/map/MapHost';
import { ScreenRouter } from '@/components/screens/ScreenRouter';
import { BuildingForm } from '@/components/profile/BuildingForm';
import { HUDFrame } from '@/components/cockpit';

// pick phase のみ右に建物入力欄を割く。後続フェーズで出すと treemap/checklist を潰すため。
export function HomeShell() {
  const phase = useFlowStore((s) => s.phase);
  const isPickPhase = phase === 'pick';

  return (
    <main
      className={
        isPickPhase
          ? 'grid h-screen w-screen overflow-hidden grid-cols-1 lg:grid-cols-[1fr_360px]'
          : 'grid h-screen w-screen overflow-hidden grid-cols-1'
      }
    >
      <div className="relative overflow-hidden">
        <MapHost />
        <ScreenRouter />
      </div>
      {isPickPhase && (
        <aside
          aria-label="プロファイル入力"
          className="hidden lg:block overflow-y-auto border-l-hairline border-hairline bg-bg-sunken/95 p-4"
        >
          <HUDFrame title="建物の情報" bodyClassName="p-4">
            <BuildingForm />
          </HUDFrame>
        </aside>
      )}
    </main>
  );
}
