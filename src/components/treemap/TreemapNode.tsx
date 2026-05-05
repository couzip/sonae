'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { DisasterTone } from '@/lib/sonae/client/disaster-style';

export interface TreemapNodeScenario {
  name?: string;
  scale?: string;
}

interface TreemapNodeProps {
  x: number;
  y: number;
  width: number;
  height: number;
  jaLabel: string;
  scenarios: TreemapNodeScenario[];
  tone: DisasterTone;
  onClick?: () => void;
  isSelected?: boolean;
  delay?: number;
}

export function TreemapNode({
  x,
  y,
  width,
  height,
  jaLabel,
  scenarios,
  tone,
  onClick,
  isSelected,
  delay = 0,
}: TreemapNodeProps) {
  const count = scenarios.length;
  const showFull = width >= 140 && height >= 80;
  const showCompact = width >= 64 && height >= 36 && !showFull;

  const style = {
    backgroundColor: tone.fill,
    borderColor: isSelected ? '#14b8a6' : tone.border,
  };

  return (
    <motion.foreignObject
      x={x}
      y={y}
      width={width}
      height={height}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.32, ease: [0.2, 0, 0, 1], delay }}
    >
      <button
        type="button"
        onClick={onClick}
        style={style}
        className={cn(
          'group h-full w-full text-left p-3 rounded-cockpit transition-colors border',
          isSelected && 'ring-1 ring-accent',
          'hover:brightness-125 focus:outline-none focus:ring-1 focus:ring-accent',
        )}
      >
        {showFull && (
          <div className="flex h-full flex-col gap-1.5">
            <div className="flex items-baseline gap-2">
              <span
                className="font-sans text-2xl leading-tight"
                style={{ color: tone.text }}
              >
                {jaLabel}
              </span>
              <span className="text-xs text-ink-dim tabular-nums">{count} 件</span>
            </div>
            <ul className="flex flex-col gap-0.5 overflow-hidden">
              {scenarios.map((s, i) => (
                <li
                  key={i}
                  className="text-xs text-ink-mute leading-snug truncate"
                >
                  <span className="text-ink">{s.name ?? '想定シナリオ'}</span>
                  {s.scale && <span className="text-ink-dim"> — {s.scale}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
        {showCompact && (
          <div className="flex h-full flex-col justify-between">
            <span
              className="font-sans text-sm leading-tight truncate"
              style={{ color: tone.text }}
            >
              {jaLabel}
            </span>
            <span className="text-xs text-ink-dim tabular-nums">{count} 件</span>
          </div>
        )}
        {!showFull && !showCompact && (
          <span
            className="font-sans text-xs leading-tight truncate block"
            style={{ color: tone.text }}
          >
            {jaLabel}
          </span>
        )}
      </button>
    </motion.foreignObject>
  );
}
