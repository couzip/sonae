'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

interface CurrentLocationButtonProps {
  onResolved: (lat: number, lng: number) => void;
  onError?: (msg: string) => void;
  className?: string;
}

export function CurrentLocationButton({
  onResolved,
  onError,
  className,
}: CurrentLocationButtonProps) {
  const [loading, setLoading] = useState(false);

  const handle = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      onError?.('ブラウザが位置情報に対応していません');
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLoading(false);
        onResolved(pos.coords.latitude, pos.coords.longitude);
      },
      (err) => {
        setLoading(false);
        const msg =
          err.code === err.PERMISSION_DENIED
            ? '位置情報の利用が許可されていません'
            : err.code === err.POSITION_UNAVAILABLE
              ? '現在地を取得できません (圏外/HTTPS必須)'
              : '現在地の取得に時間がかかっています';
        onError?.(msg);
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  };

  return (
    <button
      type="button"
      onClick={handle}
      disabled={loading}
      className={cn(
        'whitespace-nowrap border-hairline border-hairline bg-bg-raised/80 hover:border-accent hover:bg-accent-soft px-3 py-2 rounded-cockpit transition-colors disabled:opacity-50 disabled:cursor-wait text-sm text-ink',
        className,
      )}
    >
      {loading ? '取得中…' : '現在地から'}
    </button>
  );
}
