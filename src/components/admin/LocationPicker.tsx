'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, MapPin, Search } from 'lucide-react';
import MapBaseClient from '@/components/map/MapBase';

export interface LocationPick {
  lat: number;
  lng: number;
  /** GSI 由来の自治体コード (5桁、JIS X 0402)。未取得時は undefined */
  code?: string;
  /** GSI 由来の都道府県コード (2桁、JIS X 0401) */
  prefecture_code?: string;
  /** lv01Nm (町名等) */
  area_label?: string;
  /** 検索結果の住所をパースして得た都道府県名 (例: 神奈川県) */
  prefecture?: string;
  /** 検索結果の住所をパースして得た自治体名 (例: 横須賀市 / 千代田区 / 中京区) */
  name?: string;
  /** 検索結果の元住所文字列 */
  address?: string;
}

const PREF_RE = /^(東京都|北海道|大阪府|京都府|.+?県)/;

export function parseAddress(address: string): { prefecture?: string; name?: string } {
  const pref = address.match(PREF_RE)?.[1];
  if (!pref) return {};
  const rest = address.slice(pref.length);
  // 政令指定都市の行政区を優先 (例: "横浜市中区...")
  const designated = rest.match(/^(.+?市.+?区)/);
  if (designated) return { prefecture: pref, name: designated[1] };
  const regular = rest.match(/^(.+?[市区町村])/);
  return { prefecture: pref, name: regular?.[1] };
}

interface ForwardHit {
  lat: number;
  lng: number;
  address: string;
}

interface Props {
  initialLat?: number;
  initialLng?: number;
  onPick: (pick: LocationPick) => void;
}

export function LocationPicker({ initialLat, initialLng, onPick }: Props) {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<ForwardHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [pinned, setPinned] = useState<{ lat: number; lng: number } | null>(
    initialLat != null && initialLng != null ? { lat: initialLat, lng: initialLng } : null,
  );
  const [reversing, setReversing] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const reverse = async (lat: number, lng: number, addressOverride?: string) => {
    setReversing(true);
    try {
      const r = await fetch('/api/admin/geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lng }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = (await r.json()) as {
        prefecture_code?: string;
        city_code?: string;
        address?: string;
      } | null;
      onPick({
        lat,
        lng,
        code: data?.city_code,
        prefecture_code: data?.prefecture_code,
        area_label: data?.address,
        address: addressOverride ?? data?.address,
      });
    } catch {
      onPick({ lat, lng, address: addressOverride });
    } finally {
      setReversing(false);
    }
  };

  const runSearch = async () => {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setSearchError(null);
    setHits([]);
    try {
      const r = await fetch(`/api/admin/geocode?q=${encodeURIComponent(q)}`);
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.error ?? `HTTP ${r.status}`);
      }
      const data = (await r.json()) as { hits: ForwardHit[] };
      setHits(data.hits);
      if (data.hits.length === 0) setSearchError('該当する場所が見つかりません');
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : String(e));
    } finally {
      setSearching(false);
    }
  };

  const pickHit = (hit: ForwardHit) => {
    setPinned({ lat: hit.lat, lng: hit.lng });
    setQuery(hit.address);
    setHits([]);
    reverse(hit.lat, hit.lng, hit.address);
  };

  const onMapClick = (lng: number, lat: number) => {
    setPinned({ lat, lng });
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => reverse(lat, lng), 500);
  };

  const onCenterChange = (lng: number, lat: number) => {
    setPinned({ lat, lng });
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => reverse(lat, lng), 350);
  };

  const inputCls =
    'w-full bg-bg-sunken border-hairline border-hairline px-3 py-2 rounded-cockpit text-sm text-ink placeholder:text-ink-dim focus:border-accent focus:outline-none';

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-dim pointer-events-none"
            strokeWidth={1.75}
            aria-hidden
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void runSearch();
              }
            }}
            placeholder="住所 / 自治体名で検索 (例: 神奈川県横須賀市)"
            className={inputCls + ' pl-9'}
          />
        </div>
        <button
          type="button"
          onClick={() => void runSearch()}
          disabled={searching || !query.trim()}
          className="inline-flex items-center gap-1.5 border-hairline border-accent bg-accent-soft hover:bg-accent-dim disabled:opacity-50 px-3 py-2 rounded-cockpit text-sm text-accent transition-colors"
        >
          {searching ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Search className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          )}
          検索
        </button>
      </div>

      {hits.length > 0 && (
        <ul className="border-hairline border-hairline rounded-cockpit overflow-hidden">
          {hits.map((h, i) => (
            <li key={`${h.lat},${h.lng},${i}`}>
              <button
                type="button"
                onClick={() => pickHit(h)}
                className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm text-ink-mute hover:bg-bg-raised hover:text-ink transition-colors border-t-hairline border-hairline first:border-t-0"
              >
                <MapPin
                  className="h-3.5 w-3.5 text-ink-dim shrink-0"
                  strokeWidth={1.75}
                  aria-hidden
                />
                <span className="truncate">{h.address}</span>
                <span className="ml-auto text-xs text-ink-dim font-mono tabular-nums shrink-0">
                  {h.lat.toFixed(4)}, {h.lng.toFixed(4)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {searchError && <div className="text-xs text-ink-mute">{searchError}</div>}

      <div className="relative h-72 w-full rounded-cockpit border-hairline border-hairline overflow-hidden bg-bg-sunken">
        <MapBaseClient
          center={pinned ? [pinned.lng, pinned.lat] : [139.6917, 35.6895]}
          zoom={pinned ? 13 : 9}
          pin={pinned}
          onMapClick={onMapClick}
          onCenterChange={onCenterChange}
          showCenterCrosshair={!pinned}
          interactive={true}
          className="absolute inset-0"
        />
      </div>

      {pinned && (
        <div className="flex items-center gap-3 text-xs text-ink-mute font-mono tabular-nums">
          <MapPin className="h-3.5 w-3.5 text-accent" strokeWidth={1.75} aria-hidden />
          <span>
            lat <span className="text-ink">{pinned.lat.toFixed(6)}</span>
          </span>
          <span className="text-ink-dim">·</span>
          <span>
            lng <span className="text-ink">{pinned.lng.toFixed(6)}</span>
          </span>
          {reversing && (
            <span className="ml-auto inline-flex items-center gap-1 text-ink-dim">
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
              逆ジオコード中
            </span>
          )}
        </div>
      )}
    </div>
  );
}
