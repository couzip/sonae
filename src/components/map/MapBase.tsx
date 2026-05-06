'use client';

import dynamic from 'next/dynamic';

const MapBaseClient = dynamic(() => import('./MapBaseClient').then((m) => m.MapBaseClient), {
  ssr: false,
  loading: () => <div style={{ position: 'absolute', inset: 0 }} className="bg-bg-sunken" />,
});

export { MapBaseClient as MapBaseInner };
export default MapBaseClient;
export { MapBaseClient as MapBase };
