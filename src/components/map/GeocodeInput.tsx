'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { MonoLabel } from '@/components/cockpit';
import { cn } from '@/lib/utils';

interface Suggestion {
  address: string;
  lat: number;
  lng: number;
}

interface GeocodeInputProps {
  onSelect: (s: Suggestion) => void;
  onError?: (msg: string | null) => void;
  placeholder?: string;
  className?: string;
}

const SUGGEST_API = '/api/suggest';

export function GeocodeInput({
  onSelect,
  onError,
  placeholder = '住所を入力して Enter (例: 横浜市中区本町6-50-10)',
  className,
}: GeocodeInputProps) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const runSearch = useCallback(async () => {
    const q = query.trim();
    if (!q) return;
    abortRef.current?.abort();
    const ctl = new AbortController();
    abortRef.current = ctl;
    const tid = setTimeout(() => ctl.abort(), 12000);
    setLoading(true);
    try {
      const r = await fetch(`${SUGGEST_API}?q=${encodeURIComponent(q)}`, {
        signal: ctl.signal,
      });
      clearTimeout(tid);
      const body = (await r.json().catch(() => ({}))) as {
        suggestions?: Suggestion[];
        error?: string;
      };
      if (!r.ok) {
        onErrorRef.current?.(body.error ?? `住所検索エラー: HTTP ${r.status}`);
        return;
      }
      const list = body.suggestions ?? [];
      setSuggestions(list);
      setOpen(list.length > 0);
      setActiveIdx(-1);
      if (list.length === 0) {
        onErrorRef.current?.(`「${q}」に一致する住所が見つかりませんでした。`);
      } else {
        onErrorRef.current?.(null);
      }
    } catch (e) {
      clearTimeout(tid);
      if (e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError')) {
        onErrorRef.current?.('住所検索が応答しません。少し待って再入力してください。');
      } else {
        const msg = e instanceof Error ? e.message : String(e);
        onErrorRef.current?.(`住所検索エラー: ${msg}`);
      }
    } finally {
      setLoading(false);
    }
  }, [query]);

  const choose = (s: Suggestion) => {
    setQuery(s.address);
    setOpen(false);
    setSuggestions([]);
    onSelect(s);
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (open && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIdx((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const idx = activeIdx >= 0 ? activeIdx : 0;
        if (suggestions[idx]) choose(suggestions[idx]);
        return;
      }
      if (e.key === 'Escape') {
        setOpen(false);
        return;
      }
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      void runSearch();
    }
  };

  const onBlur = () => {
    setTimeout(() => {
      if (!open && query.trim() && suggestions.length === 0) {
        void runSearch();
      }
    }, 150);
  };

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    if (!e.target.value.trim()) {
      setSuggestions([]);
      setOpen(false);
      abortRef.current?.abort();
    }
  };

  return (
    <div className={cn('relative w-full', className)}>
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={onChange}
          onKeyDown={onKey}
          onBlur={onBlur}
          onFocus={() => suggestions.length && setOpen(true)}
          placeholder={placeholder}
          className="w-full font-mono text-mono-sm bg-bg-raised/80 border-hairline border-hairline focus:border-accent outline-none rounded-cockpit pl-3 pr-9 py-2 text-ink placeholder:text-ink-dim"
        />
        {loading && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-2 flex items-center"
          >
            <span className="inline-block w-3 h-3 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </span>
        )}
      </div>
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
