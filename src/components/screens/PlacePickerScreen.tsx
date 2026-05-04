'use client';

import { useFlowStore } from '@/stores/useFlowStore';
import { useLocationStore } from '@/stores/useLocationStore';
import MapBaseClient from '@/components/map/MapBase';
import { LocationInputBar } from '@/components/map/LocationInputBar';
import { MonoLabel, HUDFrame } from '@/components/cockpit';

export function PlacePickerScreen() {
  const setPhase = useFlowStore((s) => s.setPhase);
  const picked = useLocationStore((s) => s.picked);
  const municipality = useLocationStore((s) => s.municipality);
  const setPicked = useLocationStore((s) => s.setPicked);
  const setMunicipality = useLocationStore((s) => s.setMunicipality);
  const setLooking = useLocationStore((s) => s.setLooking);
  const setError = useLocationStore((s) => s.setError);

  const onMapClick = async (lng: number, lat: number) => {
    setPicked({ lat, lng, address: '', source: 'click' });
    setLooking(true);
    try {
      const r = await fetch('/api/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'click', value: { lat, lng } }),
      });
      const data = await r.json();
      if (!r.ok) {
        setError(data.error ?? `lookup HTTP ${r.status}`);
        return;
      }
      setPicked({ lat, lng, address: data.resolved.address, source: 'click' });
      setMunicipality({
        code: data.municipality_code,
        name: data.name,
        prefecture: data.prefecture,
      });
    } catch (e: any) {
      setError(`地図クリックの解決に失敗: ${e?.message ?? e}`);
    } finally {
      setLooking(false);
    }
  };

  return (
    <div className="relative h-full w-full bg-bg">
      <MapBaseClient onMapClick={onMapClick} pin={picked} className="absolute inset-0" />

      <div className="pointer-events-auto">
        <LocationInputBar />
      </div>

      {/* Bottom HUD: serial + start button */}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 p-4 z-20">
        <div className="flex items-end justify-between gap-4 max-w-5xl mx-auto">
          <div className="pointer-events-auto corner-tick border-hairline border-hairline-strong bg-bg-sunken/90 backdrop-blur px-4 py-3 rounded-cockpit min-w-[260px]">
            <MonoLabel size="2xs" tone="dim">
              SELECTED LOCATION
            </MonoLabel>
            <div className="mt-1">
              {municipality ? (
                <>
                  <div className="font-sans text-lg text-ink leading-tight">
                    {municipality.prefecture} {municipality.name}
                  </div>
                  <MonoLabel size="2xs" tone="mute">
                    CODE {municipality.code}
                    {picked && (
                      <>
                        {' · '}
                        {picked.lat.toFixed(4)}, {picked.lng.toFixed(4)}
                      </>
                    )}
                  </MonoLabel>
                </>
              ) : (
                <MonoLabel size="xs" tone="dim" uppercase={false}>
                  3方式のいずれかで場所を選択してください
                </MonoLabel>
              )}
            </div>
          </div>

          <div className="pointer-events-auto">
            <button
              type="button"
              disabled={!municipality}
              onClick={() => setPhase('research')}
              className="corner-tick disabled:opacity-30 disabled:cursor-not-allowed border-hairline border-accent bg-accent-soft hover:bg-accent-dim px-6 py-3 rounded-cockpit transition-colors"
            >
              <MonoLabel size="sm" tone="accent">
                ▶ この場所で開始
              </MonoLabel>
            </button>
          </div>
        </div>
      </div>

      {/* Top-left serial */}
      <div className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 z-20 hidden md:block">
        <HUDFrame
          serial="SONAE / SCN-01"
          title="場所選択"
          className="w-44 bg-bg-sunken/70 backdrop-blur"
          bodyClassName="p-3"
        >
          <MonoLabel size="2xs" tone="dim" uppercase={false}>
            事前の備えを、コックピットで。
          </MonoLabel>
          <div className="mt-2">
            <MonoLabel size="2xs" tone="dim">
              PHASE 1 / 5
            </MonoLabel>
          </div>
        </HUDFrame>
      </div>
    </div>
  );
}
