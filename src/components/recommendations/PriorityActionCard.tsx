'use client';

import { motion } from 'framer-motion';
import { MonoLabel, HairlineDivider } from '@/components/cockpit';
import { cn } from '@/lib/utils';

interface PriorityActionCardProps {
  index: number;
  actionId: string;
  label: string;
  reasoning: string;
  urgency: 'this_week' | 'this_month' | 'long_term';
  effortSummary: string;
  relevantUserFactors: string[];
  delay?: number;
}

const URGENCY_LABEL: Record<PriorityActionCardProps['urgency'], string> = {
  this_week: '今週',
  this_month: '今月',
  long_term: '中長期',
};

const URGENCY_COLOR: Record<PriorityActionCardProps['urgency'], string> = {
  this_week: 'border-accent text-accent',
  this_month: 'border-scale-md/70 text-scale-md',
  long_term: 'border-hairline text-ink-mute',
};

export function PriorityActionCard({
  index,
  actionId,
  label,
  reasoning,
  urgency,
  effortSummary,
  relevantUserFactors,
  delay = 0,
}: PriorityActionCardProps) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, delay, ease: [0.2, 0, 0, 1] }}
      className="corner-tick border-hairline border-hairline rounded-cockpit p-4 bg-bg-raised/40"
    >
      <header className="flex items-baseline justify-between mb-2">
        <div className="flex items-baseline gap-3">
          <MonoLabel size="2xs" tone="dim">
            #{String(index + 1).padStart(2, '0')}
          </MonoLabel>
          <h3 className="font-sans text-base text-ink">{label}</h3>
        </div>
        <span
          className={cn(
            'inline-flex items-center px-2 py-0.5 border-hairline rounded-cockpit',
            URGENCY_COLOR[urgency],
          )}
        >
          <MonoLabel
            size="2xs"
            tone="default"
            className={URGENCY_COLOR[urgency].split(' ').find((c) => c.startsWith('text-')) ?? ''}
          >
            {URGENCY_LABEL[urgency]}
          </MonoLabel>
        </span>
      </header>

      <p className="font-sans text-sm text-ink-mute leading-relaxed mb-2">{reasoning}</p>

      <HairlineDivider variant="dashed" />

      <div className="mt-2 flex items-center justify-between gap-3">
        <MonoLabel size="2xs" tone="mute">
          {effortSummary}
        </MonoLabel>
        <div className="flex items-center gap-1.5 flex-wrap">
          {relevantUserFactors.map((f, i) => (
            <span
              key={i}
              className="inline-flex items-center px-1.5 py-0.5 border-hairline border-hairline rounded-cockpit"
            >
              <MonoLabel size="2xs" tone="dim">
                {f}
              </MonoLabel>
            </span>
          ))}
        </div>
      </div>
      <div className="mt-2">
        <MonoLabel size="2xs" tone="dim">
          {actionId.toUpperCase()}
        </MonoLabel>
      </div>
    </motion.article>
  );
}
