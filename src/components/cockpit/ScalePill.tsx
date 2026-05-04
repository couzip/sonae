import { cn } from '@/lib/utils';
import { MonoLabel } from './MonoLabel';

type Scale = 'very_high' | 'high' | 'medium' | 'low' | 'unknown';

interface ScalePillProps {
  scale: Scale;
  className?: string;
}

const labelMap: Record<Scale, string> = {
  very_high: '極大',
  high: '大',
  medium: '中',
  low: '小',
  unknown: '—',
};

const styleMap: Record<Scale, string> = {
  very_high: 'border-scale-lg text-ink',
  high: 'border-scale-md text-ink',
  medium: 'border-scale-sm text-ink-mute',
  low: 'border-hairline text-ink-dim',
  unknown: 'border-hairline text-ink-dim',
};

export function ScalePill({ scale, className }: ScalePillProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center border-hairline px-1.5 py-0.5 rounded-cockpit',
        styleMap[scale],
        className,
      )}
    >
      <MonoLabel size="2xs" tone="default" uppercase>
        想定 {labelMap[scale]}
      </MonoLabel>
    </span>
  );
}
