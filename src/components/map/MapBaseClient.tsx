'use client';

import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

interface MapBaseClientProps {
  center?: [number, number];
  zoom?: number;
  onMapClick?: (lng: number, lat: number) => void;
  pin?: { lat: number; lng: number } | null;
  className?: string;
  interactive?: boolean;
}

const GSI_DARK = 'https://cyberjapandata.gsi.go.jp/xyz/dark/{z}/{x}/{y}.png';
const GSI_PALE = 'https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png';

export function MapBaseClient({
  center = [139.638, 35.4437], // 横浜
  zoom = 11,
  onMapClick,
  pin,
  className,
  interactive = true,
}: MapBaseClientProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          gsi_dark: {
            type: 'raster',
            tiles: [GSI_DARK],
            tileSize: 256,
            attribution:
              '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener">国土地理院</a>',
          },
          gsi_pale: {
            type: 'raster',
            tiles: [GSI_PALE],
            tileSize: 256,
          },
        },
        layers: [
          {
            id: 'gsi-dark',
            type: 'raster',
            source: 'gsi_dark',
            paint: { 'raster-opacity': 0.85 },
          },
        ],
      },
      center,
      zoom,
      interactive,
      attributionControl: { compact: true },
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');

    if (onMapClick) {
      map.on('click', (e) => {
        onMapClick(e.lngLat.lng, e.lngLat.lat);
      });
    }

    mapRef.current = map;
    return () => {
      markerRef.current?.remove();
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update pin. lat/lng で再評価する (pin オブジェクトの参照変化ではなく値変化を見る)。
  const pinLat = pin?.lat;
  const pinLng = pin?.lng;
  useEffect(() => {
    if (!mapRef.current) return;
    if (pinLat != null && pinLng != null) {
      const el = document.createElement('div');
      el.className =
        'h-3 w-3 rounded-full bg-accent ring-4 ring-accent/30 shadow-[0_0_12px_rgba(20,184,166,0.6)]';
      if (markerRef.current) markerRef.current.remove();
      markerRef.current = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([pinLng, pinLat])
        .addTo(mapRef.current);
      mapRef.current.flyTo({ center: [pinLng, pinLat], zoom: 13, speed: 1.4 });
    } else if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
  }, [pinLat, pinLng]);

  return <div ref={containerRef} className={className} />;
}
