'use client';

import { useEffect, useRef, useState } from 'react';
import { MonoLabel } from '@/components/cockpit';
import { cn } from '@/lib/utils';

interface Suggestion {
  address: string;
  lat: number;
  lng: number;
}

interface GeocodeInputProps {
  onSelect: (s: Suggestion) => void;
  onError?: (msg: string) => void;
  placeholder?: string;
  className?: string;
}

const GSI_FORWARD = 'https://msearch.gsi.go.jp/address-search/AddressSearch';

export function GeocodeInput({
  onSelect,
  onError,
  placeholder = '住所を入力 (例: 横浜市中区本町6-50-10)',
  className,
}: GeocodeInputProps) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!query.trim()) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const r = await fetch(`${GSI_FORWARD}?q=${encodeURIComponent(query)}`);
        if (!r.ok) {
          onError?.(`住所検索エラー: HTTP ${r.status}`);
          return;
        }
        const arr = (await r.json()) as Array<{
          geometry: { coordinates: [number, number] };
          properties: { title: string };
        }>;
        const list = arr.slice(0, 5).map((it) => ({
          address: it.properties.title,
          lng: it.geometry.coordinates[0],
          lat: it.geometry.coordinates[1],
        }));
        setSuggestions(list);
        setOpen(list.length > 0);
        setActiveIdx(-1);
      } catch (e: any) {
        onError?.(`住所検索エラー: ${e?.message ?? e}`);
      }
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, onError]);

  const choose = (s: Suggestion) => {
    setQuery(s.address);
    setOpen(false);
    onSelect(s);
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const idx = activeIdx >= 0 ? activeIdx : 0;
      if (suggestions[idx]) choose(suggestions[idx]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div className={cn('relative w-full', className)}>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={onKey}
        onFocus={() => suggestions.length && setOpen(true)}
        placeholder={placeholder}
        className="w-full font-mono text-mono-sm bg-bg-raised/80 border-hairline border-hairline focus:border-accent outline-none rounded-cockpit px-3 py-2 text-ink placeholder:text-ink-dim"
      />
      {open && (
        <ul
          role="listbox"
          className="absolute left-0 right-0 top-full mt-1 z-30 corner-tick border-hairline border-hairline-strong bg-bg-sunken rounded-cockpit max-h-72 overflow-auto"
        >
          {suggestions.map((s, i) => (
            <li key={`${s.address}-${i}`}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(s);
                }}
                className={cn(
                  'w-full text-left px-3 py-2 hover:bg-accent-soft transition-colors',
                  i === activeIdx && 'bg-accent-soft',
                )}
              >
                <div className="flex items-baseline gap-2">
                  <MonoLabel size="2xs" tone="dim">
                    {String(i + 1).padStart(2, '0')}
                  </MonoLabel>
                  <span className="font-sans text-sm text-ink truncate">{s.address}</span>
                </div>
                <MonoLabel size="2xs" tone="dim">
                  {s.lat.toFixed(4)}, {s.lng.toFixed(4)}
                </MonoLabel>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
