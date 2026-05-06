import { cn } from '@/lib/utils';

interface HUDFrameProps {
  children: React.ReactNode;
  title?: string;
  rightSlot?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}

export function HUDFrame({ children, title, rightSlot, className, bodyClassName }: HUDFrameProps) {
  return (
    <div
      className={cn(
        'relative flex h-full flex-col bg-bg-raised/30 backdrop-blur-sm border-hairline border-hairline rounded-cockpit',
        className,
      )}
    >
      {(title || rightSlot) && (
        <header className="flex items-center justify-between border-b-hairline border-hairline px-4 py-2.5">
          {title && <h2 className="font-sans text-sm text-ink">{title}</h2>}
          {rightSlot && <div className="flex items-center gap-2">{rightSlot}</div>}
        </header>
      )}
      <div className={cn('flex-1 overflow-auto', bodyClassName)}>{children}</div>
    </div>
  );
}
