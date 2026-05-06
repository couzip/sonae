'use client';

import { useFlowStore } from '@/stores/useFlowStore';
import { useLocationStore } from '@/stores/useLocationStore';
import { LocationInputBar } from '@/components/map/LocationInputBar';

export function PlacePickerScreen() {
  const setPhase = useFlowStore((s) => s.setPhase);
  const picked = useLocationStore((s) => s.picked);
  const municipality = useLocationStore((s) => s.municipality);

  return (
    <div className="relative h-full w-full pointer-events-none">
      <LocationInputBar />

      <div className="pointer-events-none absolute bottom-0 left-0 right-0 p-4 z-20">
        <div className="flex items-end justify-between gap-4 max-w-5xl mx-auto">
          <div className="pointer-events-auto border-hairline border-hairline bg-bg-sunken/90 backdrop-blur px-4 py-3 rounded-cockpit min-w-[260px]">
            {municipality ? (
              <>
                <div className="font-sans text-lg text-ink leading-tight">
                  {municipality.prefecture} {municipality.name}
                </div>
                {picked && (
                  <div className="text-xs text-ink-mute mt-0.5 tabular-nums">
                    {picked.lat.toFixed(4)}, {picked.lng.toFixed(4)}
                  </div>
                )}
              </>
            ) : (
              <div className="text-sm text-ink-mute">地図をクリック、または上から場所を入力</div>
            )}
          </div>

          <div className="pointer-events-auto">
            <button
              type="button"
              disabled={!municipality}
              onClick={() => setPhase('research')}
              className="disabled:opacity-30 disabled:cursor-not-allowed border-hairline border-accent bg-accent-soft hover:bg-accent-dim px-6 py-3 rounded-cockpit transition-colors text-accent"
            >
              この場所で開始
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
