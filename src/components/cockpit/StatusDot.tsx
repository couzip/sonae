import { cn } from '@/lib/utils';

type Status = 'idle' | 'running' | 'done' | 'error';

interface StatusDotProps {
  status: Status;
  size?: 'sm' | 'md';
  className?: string;
}

const colorMap: Record<Status, string> = {
  idle: 'bg-ink-dim',
  running: 'bg-accent animate-tick',
  done: 'bg-accent',
  error: 'bg-scale-lg',
};

export function StatusDot({ status, size = 'sm', className }: StatusDotProps) {
  const dim = size === 'sm' ? 'h-1.5 w-1.5' : 'h-2 w-2';
  return (
    <span
      role="status"
      aria-label={status}
      className={cn('inline-block rounded-full', dim, colorMap[status], className)}
    />
  );
}
