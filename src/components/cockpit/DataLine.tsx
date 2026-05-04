import { cn } from '@/lib/utils';
import { MonoLabel } from './MonoLabel';

interface DataLineProps {
  label: string;
  value: React.ReactNode;
  unit?: string;
  source?: React.ReactNode;
  className?: string;
}

export function DataLine({ label, value, unit, source, className }: DataLineProps) {
  return (
    <div className={cn('flex w-full items-baseline py-1.5', className)}>
      <MonoLabel size="xs" tone="mute">
        {label}
      </MonoLabel>
      <span className="leader-dots" aria-hidden="true" />
      <span className="font-mono tabular-nums text-mono-sm text-ink">
        {value}
        {unit && <span className="ml-1 text-mono-xs text-ink-mute">{unit}</span>}
      </span>
      {source && <span className="ml-2 inline-flex">{source}</span>}
    </div>
  );
}
