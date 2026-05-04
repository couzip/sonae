import { cn } from '@/lib/utils';

type Size = '2xs' | 'xs' | 'sm' | 'base';

interface MonoLabelProps {
  children: React.ReactNode;
  size?: Size;
  tone?: 'default' | 'mute' | 'dim' | 'accent';
  uppercase?: boolean;
  className?: string;
}

const sizeMap: Record<Size, string> = {
  '2xs': 'text-mono-2xs',
  xs: 'text-mono-xs',
  sm: 'text-mono-sm',
  base: 'text-mono-base',
};

const toneMap = {
  default: 'text-ink',
  mute: 'text-ink-mute',
  dim: 'text-ink-dim',
  accent: 'text-accent',
};

export function MonoLabel({
  children,
  size = 'xs',
  tone = 'mute',
  uppercase = true,
  className,
}: MonoLabelProps) {
  return (
    <span
      className={cn(
        'font-mono tabular-nums tracking-cockpit',
        sizeMap[size],
        toneMap[tone],
        uppercase && 'uppercase',
        className,
      )}
    >
      {children}
    </span>
  );
}
