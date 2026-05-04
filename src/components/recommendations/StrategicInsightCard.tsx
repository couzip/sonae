'use client';

import { motion } from 'framer-motion';
import { MonoLabel, HairlineDivider } from '@/components/cockpit';

interface StrategicInsightCardProps {
  index: number;
  headline: string;
  rationale: string;
  userFactor: string;
  delay?: number;
}

export function StrategicInsightCard({
  index,
  headline,
  rationale,
  userFactor,
  delay = 0,
}: StrategicInsightCardProps) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, delay, ease: [0.2, 0, 0, 1] }}
      className="relative corner-tick border-hairline border-accent/30 bg-accent-soft/15 rounded-cockpit p-4"
    >
      <header className="flex items-start gap-3 mb-2">
        <span className="font-mono text-mono-base tabular-nums text-accent leading-none mt-0.5">
          {String(index + 1).padStart(2, '0')}
        </span>
        <h3 className="font-sans text-base text-ink leading-tight flex-1">{headline}</h3>
      </header>
      <p className="font-sans text-sm text-ink-mute leading-relaxed">{rationale}</p>
      {userFactor && (
        <>
          <HairlineDivider variant="dashed" className="my-2" />
          <div className="flex items-baseline gap-2">
            <MonoLabel size="2xs" tone="dim">
              YOUR CONTEXT
            </MonoLabel>
            <span className="font-sans text-xs text-ink-mute">{userFactor}</span>
          </div>
        </>
      )}
    </motion.article>
  );
}
