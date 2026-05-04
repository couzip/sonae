import { cn } from '@/lib/utils';

interface HairlineDividerProps {
  variant?: 'solid' | 'dashed';
  tone?: 'default' | 'strong';
  orientation?: 'horizontal' | 'vertical';
  className?: string;
}

export function HairlineDivider({
  variant = 'solid',
  tone = 'default',
  orientation = 'horizontal',
  className,
}: HairlineDividerProps) {
  const isHorizontal = orientation === 'horizontal';
  const colorClass = tone === 'strong' ? 'border-hairline-strong' : 'border-hairline';
  const styleClass = variant === 'dashed' ? 'border-dashed' : 'border-solid';

  return (
    <div
      role="separator"
      aria-orientation={orientation}
      className={cn(
        'shrink-0',
        isHorizontal ? 'w-full border-t-hairline' : 'h-full border-l-hairline',
        colorClass,
        styleClass,
        className,
      )}
    />
  );
}
