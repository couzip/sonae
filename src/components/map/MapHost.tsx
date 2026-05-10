'use client';

import { useEffect, useRef } from 'react';
import { useFlowStore } from '@/stores/useFlowStore';
import { useLocationStore } from '@/stores/useLocationStore';
import MapBaseClient from './MapBase';

export function MapHost() {
  const phase = useFlowStore((s) => s.phase);
  const picked = useLocationStore((s) => s.picked);
  const setPicked = useLocationStore((s) => s.setPicked);
  const setMunicipality = useLocationStore((s) => s.setMunicipality);
  const setLooking = useLocationStore((s) => s.setLooking);
  const setError = useLocationStore((s) => s.setError);

  const isInteractive = phase === 'pick';
  const isVisible = phase === 'pick' || phase === 'research' || phase === 'grid';

  const lookupAbortRef = useRef<AbortController | null>(null);
  const lookupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      lookupAbortRef.current?.abort();
      if (lookupTimerRef.current) clearTimeout(lookupTimerRef.current);
    };
  }, []);

  const resolve = async (lat: number, lng: number, source: 'click' | 'drag') => {
    lookupAbortRef.current?.abort();
    const ctl = new AbortController();
    lookupAbortRef.current = ctl;

    setPicked({ lat, lng, address: '', source });
    setLooking(true);
    try {
      const r = await fetch('/api/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: source === 'drag' ? 'click' : 'click', value: { lat, lng } }),
        signal: ctl.signal,
      });
      const data = await r.json();
      if (!r.ok) {
        setMunicipality(null);
        setError(data.error ?? `lookup HTTP ${r.status}`);
        return;
      }
      setPicked({ lat, lng, address: data.resolved.address, source });
      setMunicipality({
        code: data.municipality_code,
        name: data.name,
        prefecture: data.prefecture,
      });
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return;
      const msg = e instanceof Error ? e.message : String(e);
      setError(`場所の読み込みに失敗しました: ${msg}`);
    } finally {
      if (lookupAbortRef.current === ctl) {
        setLooking(false);
        lookupAbortRef.current = null;
      }
    }
  };

  const handleClick = isInteractive
    ? (lng: number, lat: number) => {
        if (lookupTimerRef.current) clearTimeout(lookupTimerRef.current);
        resolve(lat, lng, 'click');
      }
    : undefined;

  const handleCenterChange = isInteractive
    ? (lng: number, lat: number) => {
        if (lookupTimerRef.current) clearTimeout(lookupTimerRef.current);
        lookupTimerRef.current = setTimeout(() => {
          resolve(lat, lng, 'drag');
        }, 350);
      }
    : undefined;

  if (!isVisible) return null;

  return (
    <div className="absolute inset-0 z-0">
      <MapBaseClient
        center={picked ? [picked.lng, picked.lat] : undefined}
        pin={picked}
        onMapClick={handleClick}
        onCenterChange={handleCenterChange}
        interactive={isInteractive}
        showCenterCrosshair={isInteractive && !picked}
        className="absolute inset-0"
      />
    </div>
  );
}
