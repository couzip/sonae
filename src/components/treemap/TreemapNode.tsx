'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { DisasterTone } from '@/lib/sonae/client/disaster-style';

export interface TreemapNodeScenario {
  name?: string;
  scale?: string;
  expected_damage?: string;
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
  const showFull = width >= 220 && height >= 140;
  const showMid = width >= 140 && height >= 80 && !showFull;
  const showCompact = width >= 64 && height >= 36 && !showFull && !showMid;

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
      <div
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        onClick={onClick}
        onKeyDown={
          onClick
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onClick();
                }
              }
            : undefined
        }
        style={style}
        className={cn(
          'group h-full w-full text-left p-3 rounded-cockpit transition-colors border overflow-hidden',
          isSelected && 'ring-1 ring-accent',
          onClick && 'cursor-pointer hover:brightness-125 focus:outline-none focus:ring-1 focus:ring-accent',
        )}
      >
        {showFull && (
          <div className="flex h-full flex-col gap-3 overflow-hidden">
            <header className="flex items-baseline gap-2 shrink-0">
              <span className="font-sans text-2xl leading-tight" style={{ color: tone.text }}>
                {jaLabel}
              </span>
              <span className="text-sm text-ink-dim tabular-nums">{count} 件</span>
            </header>
            <ul className="flex flex-col gap-3 overflow-y-auto leading-relaxed min-h-0">
              {scenarios.map((s, i) => (
                <li key={i} className="flex flex-col gap-1">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-sm text-ink font-sans">
                      {s.name ?? '想定シナリオ'}
                    </span>
                    {s.scale && (
                      <span className="text-xs text-ink-dim tabular-nums">{s.scale}</span>
                    )}
                  </div>
                  {s.expected_damage && (
                    <p className="text-xs text-ink-mute leading-relaxed">{s.expected_damage}</p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
        {showMid && (
          <div className="flex h-full flex-col gap-2 overflow-hidden">
            <header className="flex items-baseline gap-2 shrink-0">
              <span className="font-sans text-lg leading-tight" style={{ color: tone.text }}>
                {jaLabel}
              </span>
              <span className="text-xs text-ink-dim tabular-nums">{count} 件</span>
            </header>
            <ul className="flex flex-col gap-1.5 overflow-y-auto text-sm leading-snug min-h-0">
              {scenarios.map((s, i) => (
                <li key={i} className="flex items-baseline gap-2 truncate">
                  <span className="text-ink truncate">{s.name ?? '想定シナリオ'}</span>
                  {s.scale && (
                    <span className="text-xs text-ink-dim shrink-0 tabular-nums">{s.scale}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
        {showCompact && (
          <div className="flex h-full flex-col justify-between overflow-hidden">
            <span
              className="font-sans text-base leading-tight truncate"
              style={{ color: tone.text }}
            >
              {jaLabel}
            </span>
            <span className="text-xs text-ink-dim tabular-nums">{count} 件</span>
          </div>
        )}
        {!showFull && !showMid && !showCompact && (
          <span
            className="font-sans text-sm leading-tight truncate block"
            style={{ color: tone.text }}
          >
            {jaLabel}
          </span>
        )}
      </div>
    </motion.foreignObject>
  );
}
