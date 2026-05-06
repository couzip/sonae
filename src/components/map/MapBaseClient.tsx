'use client';

import { useEffect, useRef } from 'react';
import { Map as MaplibreMap, Marker, NavigationControl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

interface MapBaseClientProps {
  center?: [number, number];
  zoom?: number;
  onMapClick?: (lng: number, lat: number) => void;
  onCenterChange?: (lng: number, lat: number) => void;
  pin?: { lat: number; lng: number } | null;
  className?: string;
  interactive?: boolean;
  showCenterCrosshair?: boolean;
}

const GSI_PALE = 'https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png';

export function MapBaseClient({
  center = [139.638, 35.4437],
  zoom = 11,
  onMapClick,
  onCenterChange,
  pin,
  className,
  interactive = true,
  showCenterCrosshair = false,
}: MapBaseClientProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MaplibreMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const resizeObsRef = useRef<ResizeObserver | null>(null);
  const onCenterChangeRef = useRef(onCenterChange);
  onCenterChangeRef.current = onCenterChange;
  const userInteractedRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new MaplibreMap({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          gsi: {
            type: 'raster',
            tiles: [GSI_PALE],
            tileSize: 256,
            attribution:
              '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener">国土地理院</a>',
          },
        },
        layers: [{ id: 'gsi', type: 'raster', source: 'gsi' }],
      },
      center,
      zoom,
      interactive,
    });

    map.addControl(new NavigationControl({ showCompass: false }), 'bottom-right');

    map.on('error', (e) => {
      // eslint-disable-next-line no-console
      console.error('[MapBase]', e?.error ?? e);
    });

    if (onMapClick) {
      map.on('click', (e) => {
        userInteractedRef.current = true;
        onMapClick(e.lngLat.lng, e.lngLat.lat);
      });
    }

    map.on('dragstart', () => {
      userInteractedRef.current = true;
    });
    map.on('moveend', (e) => {
      // flyTo / programmatic move を除外: ユーザー操作のみで lookup 起動
      if (!userInteractedRef.current) return;
      if (e.originalEvent == null && !map.isMoving()) return;
      const c = map.getCenter();
      onCenterChangeRef.current?.(c.lng, c.lat);
    });

    mapRef.current = map;

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => {
        try {
          map.resize();
        } catch {
          /* removed */
        }
      });
      ro.observe(containerRef.current);
      resizeObsRef.current = ro;
    }
    requestAnimationFrame(() => {
      try {
        map.resize();
      } catch {
        /* noop */
      }
    });

    return () => {
      resizeObsRef.current?.disconnect();
      resizeObsRef.current = null;
      markerRef.current?.remove();
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // interactive prop の変更を runtime に反映する。constructor の `interactive`
  // は mount 時の一度きりなので、phase が grid → pick に戻った時など、
  // この effect が drag/zoom を enable/disable する。
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const handlers = [
      map.dragPan,
      map.scrollZoom,
      map.boxZoom,
      map.dragRotate,
      map.keyboard,
      map.doubleClickZoom,
      map.touchZoomRotate,
    ];
    for (const h of handlers) {
      if (interactive) h.enable();
      else h.disable();
    }
  }, [interactive]);

  const pinLat = pin?.lat;
  const pinLng = pin?.lng;
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (pinLat != null && pinLng != null) {
      const el = document.createElement('div');
      el.className =
        'h-3 w-3 rounded-full bg-accent ring-4 ring-accent/30 shadow-[0_0_12px_rgba(20,184,166,0.6)]';
      if (markerRef.current) markerRef.current.remove();
      markerRef.current = new Marker({ element: el, anchor: 'center' })
        .setLngLat([pinLng, pinLat])
        .addTo(map);
      const cur = map.getCenter();
      const dx = cur.lng - pinLng;
      const dy = cur.lat - pinLat;
      const distDeg = Math.sqrt(dx * dx + dy * dy);
      // ~0.05deg ≒ 5km。それ以上ズレている時だけ flyTo
      if (distDeg > 0.05) {
        userInteractedRef.current = false;
        map.flyTo({ center: [pinLng, pinLat], zoom: 13, speed: 1.4 });
      }
    } else if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
  }, [pinLat, pinLng]);

  return (
    <>
      <div
        ref={containerRef}
        className={className}
        style={{
          position: 'absolute',
          inset: 0,
          filter: 'invert(0.92) hue-rotate(180deg) saturate(0.6) brightness(0.85)',
        }}
      />
      {showCenterCrosshair && (
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10"
        >
          <div className="relative h-8 w-8">
            <span className="absolute left-1/2 top-0 h-3 w-px -translate-x-1/2 bg-accent/80" />
            <span className="absolute left-1/2 bottom-0 h-3 w-px -translate-x-1/2 bg-accent/80" />
            <span className="absolute top-1/2 left-0 w-3 h-px -translate-y-1/2 bg-accent/80" />
            <span className="absolute top-1/2 right-0 w-3 h-px -translate-y-1/2 bg-accent/80" />
            <span className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-accent" />
          </div>
        </div>
      )}
    </>
  );
}
