'use client';

import { motion } from 'framer-motion';
import { HairlineDivider } from '@/components/cockpit';
import { cn } from '@/lib/utils';

interface PriorityActionCardProps {
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
      className="border-hairline border-hairline rounded-cockpit p-4 bg-bg-raised/40"
    >
      <header className="flex items-baseline justify-between gap-3 mb-2">
        <h3 className="font-sans text-base text-ink leading-snug">{label}</h3>
        <span
          className={cn(
            'inline-flex items-center px-2 py-0.5 border-hairline rounded-cockpit shrink-0',
            URGENCY_COLOR[urgency],
          )}
        >
          <span className="text-xs">{URGENCY_LABEL[urgency]}</span>
        </span>
      </header>

      <p className="font-sans text-sm text-ink-mute leading-relaxed mb-2">{reasoning}</p>

      <HairlineDivider variant="dashed" />

      <div className="mt-2 flex items-center justify-between gap-3 flex-wrap">
        <span className="text-xs text-ink-mute">{effortSummary}</span>
        {relevantUserFactors.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {relevantUserFactors.map((f, i) => (
              <span
                key={i}
                className="inline-flex items-center px-1.5 py-0.5 border-hairline border-hairline rounded-cockpit text-xs text-ink-dim"
              >
                {f}
              </span>
            ))}
          </div>
        )}
      </div>
    </motion.article>
  );
}
