'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface TreemapNodeProps {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  jaLabel: string;
  scenarioCount: number;
  scaleClass: 'lg' | 'md' | 'sm';
  onClick?: () => void;
  isSelected?: boolean;
  delay?: number;
}

const SCALE_BORDER: Record<TreemapNodeProps['scaleClass'], string> = {
  lg: 'border-scale-lg/70',
  md: 'border-scale-md/70',
  sm: 'border-scale-sm/70',
};
const SCALE_BG: Record<TreemapNodeProps['scaleClass'], string> = {
  lg: 'bg-scale-lg/15',
  md: 'bg-scale-md/15',
  sm: 'bg-scale-sm/10',
};

export function TreemapNode({
  x,
  y,
  width,
  height,
  label,
  jaLabel,
  scenarioCount,
  scaleClass,
  onClick,
  isSelected,
  delay = 0,
}: TreemapNodeProps) {
  const showFull = width >= 120 && height >= 60;
  const showCompact = width >= 64 && height >= 32 && !showFull;

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
        className={cn(
          'corner-tick group h-full w-full text-left p-2 border-hairline rounded-cockpit transition-colors',
          SCALE_BORDER[scaleClass],
          SCALE_BG[scaleClass],
          isSelected && 'border-accent ring-1 ring-accent',
          'hover:border-accent hover:bg-accent-soft/40 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent',
        )}
      >
        {showFull && (
          <div className="flex h-full flex-col">
            <span className="font-mono text-mono-2xs uppercase tracking-cockpit text-ink-dim">
              {label}
            </span>
            <span className="font-sans text-2xl text-ink leading-tight mt-0.5">{jaLabel}</span>
            <span className="mt-auto font-mono text-mono-2xs tabular-nums text-ink-mute">
              {String(scenarioCount).padStart(2, '0')} scenarios
            </span>
          </div>
        )}
        {showCompact && (
          <div className="flex h-full flex-col justify-between">
            <span className="font-sans text-sm text-ink leading-tight truncate">{jaLabel}</span>
            <span className="font-mono text-mono-2xs tabular-nums text-ink-dim">
              {scenarioCount}
            </span>
          </div>
        )}
        {!showFull && !showCompact && (
          <span className="font-mono text-mono-2xs uppercase tracking-cockpit text-ink-mute truncate block">
            {jaLabel}
          </span>
        )}
      </button>
    </motion.foreignObject>
  );
}
