'use client';

import { disasterTone } from '@/lib/sonae/client/disaster-style';

interface TreemapLegendProps {
  types: string[];
}

export function TreemapLegend({ types }: TreemapLegendProps) {
  if (types.length === 0) return null;
  return (
    <div className="flex items-center gap-3 flex-wrap">
      {types.map((t) => {
        const tone = disasterTone(t);
        return (
          <div key={t} className="flex items-center gap-1.5">
            <span
              className="block h-2.5 w-2.5 rounded-cockpit border"
              style={{ backgroundColor: tone.fill, borderColor: tone.border }}
            />
            <span className="text-xs" style={{ color: tone.text }}>
              {t}
            </span>
          </div>
        );
      })}
    </div>
  );
}
