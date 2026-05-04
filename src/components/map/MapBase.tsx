'use client';

import dynamic from 'next/dynamic';
import { MonoLabel } from '@/components/cockpit';

const MapBaseClient = dynamic(() => import('./MapBaseClient').then((m) => m.MapBaseClient), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full bg-bg-sunken flex items-center justify-center">
      <div className="grid grid-cols-12 grid-rows-12 absolute inset-0 opacity-20">
        {Array.from({ length: 12 * 12 }).map((_, i) => (
          <div key={i} className="border-hairline border-hairline" />
        ))}
      </div>
      <MonoLabel size="xs" tone="dim">
        MAP LOADING ...
      </MonoLabel>
    </div>
  ),
});

export { MapBaseClient as MapBaseInner };
export default MapBaseClient;
export { MapBaseClient as MapBase };
