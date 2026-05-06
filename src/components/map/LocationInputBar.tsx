'use client';

import { useLocationStore } from '@/stores/useLocationStore';
import { CurrentLocationButton } from './CurrentLocationButton';
import { GeocodeInput } from './GeocodeInput';

async function lookup(payload: {
  mode: 'gps' | 'address' | 'click';
  value: string | { lat: number; lng: number };
}) {
  const r = await fetch('/api/lookup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.error ?? `lookup HTTP ${r.status}`);
  }
  return r.json() as Promise<{
    municipality_code: string;
    name: string;
    prefecture: string;
    source: string;
    resolved: { lat: number; lng: number; address: string };
  }>;
}

export function LocationInputBar() {
  const setPicked = useLocationStore((s) => s.setPicked);
  const setMunicipality = useLocationStore((s) => s.setMunicipality);
  const setLooking = useLocationStore((s) => s.setLooking);
  const setError = useLocationStore((s) => s.setError);
  const error = useLocationStore((s) => s.error);
  const isLooking = useLocationStore((s) => s.isLooking);

  const onGps = async (lat: number, lng: number) => {
    setLooking(true);
    try {
      const res = await lookup({ mode: 'gps', value: { lat, lng } });
      setPicked({
        lat: res.resolved.lat || lat,
        lng: res.resolved.lng || lng,
        address: res.resolved.address,
        source: 'gps',
      });
      setMunicipality({ code: res.municipality_code, name: res.name, prefecture: res.prefecture });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`現在地から自治体を特定できません: ${msg}`);
    } finally {
      setLooking(false);
    }
  };

  const onAddress = async (s: { address: string; lat: number; lng: number }) => {
    setLooking(true);
    try {
      const res = await lookup({ mode: 'address', value: s.address });
      setPicked({ lat: s.lat, lng: s.lng, address: res.resolved.address, source: 'address' });
      setMunicipality({ code: res.municipality_code, name: res.name, prefecture: res.prefecture });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`住所から自治体を特定できません: ${msg}`);
    } finally {
      setLooking(false);
    }
  };

  return (
    <div className="absolute top-0 left-0 right-0 z-20 p-4 pointer-events-none">
      <div className="mx-auto max-w-3xl border-hairline border-hairline bg-bg-sunken/95 backdrop-blur p-3 rounded-cockpit pointer-events-auto">
        <div className="flex items-center gap-3">
          <CurrentLocationButton onResolved={onGps} onError={(msg) => setError(msg)} />
          <div className="h-6 w-px bg-hairline" />
          <GeocodeInput onSelect={onAddress} onError={(msg) => setError(msg)} />
        </div>
        {(error || isLooking) && (
          <div className="mt-2 text-xs">
            {isLooking && <span className="text-ink-mute">自治体を特定しています…</span>}
            {error && !isLooking && <span className="text-scale-lg">{error}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
