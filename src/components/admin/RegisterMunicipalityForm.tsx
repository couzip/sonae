'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Loader2, Save } from 'lucide-react';
import { LocationPicker, parseAddress, type LocationPick } from './LocationPicker';

export function RegisterMunicipalityForm() {
  const router = useRouter();
  const [pick, setPick] = useState<LocationPick | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const derived = (() => {
    if (!pick) return null;
    const parsed = pick.address ? parseAddress(pick.address) : {};
    const prefecture = parsed.prefecture;
    const name = parsed.name;
    return {
      code: pick.code,
      prefecture_code: pick.prefecture_code,
      prefecture,
      name,
      lat: pick.lat,
      lng: pick.lng,
    };
  })();

  const ready = !!(derived?.code && derived.prefecture_code && derived.prefecture && derived.name);

  const onSubmit = async () => {
    if (!derived || !ready) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch('/api/admin/municipalities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: derived.code,
          name: derived.name,
          prefecture: derived.prefecture,
          prefecture_code: derived.prefecture_code,
          lat: derived.lat,
          lng: derived.lng,
          name_aliases: [derived.name],
        }),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.error ?? `HTTP ${r.status}`);
      }
      router.push(`/admin/municipalities/${encodeURIComponent(derived.code!)}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <LocationPicker onPick={(p) => setPick({ ...p })} />

      {derived && (
        <div className="border-hairline border-hairline rounded-cockpit p-4 bg-bg-raised/30 flex items-center justify-between gap-3">
          <div>
            <div className="text-xs text-ink-mute">登録対象</div>
            <div className="font-sans text-base text-ink mt-0.5">
              {derived.prefecture ?? '—'} {derived.name ?? '—'}
            </div>
          </div>
          <button
            type="button"
            onClick={onSubmit}
            disabled={!ready || busy}
            className="inline-flex items-center gap-1.5 border-hairline border-accent bg-accent-soft hover:bg-accent-dim disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded-cockpit text-sm text-accent transition-colors"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Save className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            )}
            登録
          </button>
        </div>
      )}

      {error && (
        <div className="inline-flex items-start gap-2 border-hairline border-scale-lg bg-scale-lg/10 p-3 rounded-cockpit text-xs text-scale-lg">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
