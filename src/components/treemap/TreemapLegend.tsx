'use client';

import { MonoLabel } from '@/components/cockpit';

export function TreemapLegend() {
  return (
    <div className="flex items-center gap-4">
      <MonoLabel size="2xs" tone="dim">
        想定規模
      </MonoLabel>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="block h-3 w-3 border-hairline border-scale-lg bg-scale-lg/20 rounded-cockpit" />
          <MonoLabel size="2xs" tone="default">
            大
          </MonoLabel>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="block h-3 w-3 border-hairline border-scale-md bg-scale-md/20 rounded-cockpit" />
          <MonoLabel size="2xs" tone="mute">
            中
          </MonoLabel>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="block h-3 w-3 border-hairline border-scale-sm bg-scale-sm/20 rounded-cockpit" />
          <MonoLabel size="2xs" tone="dim">
            小
          </MonoLabel>
        </div>
      </div>
    </div>
  );
}
