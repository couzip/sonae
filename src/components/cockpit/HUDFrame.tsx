import { cn } from '@/lib/utils';
import { MonoLabel } from './MonoLabel';

interface HUDFrameProps {
  children: React.ReactNode;
  serial?: string;
  title?: string;
  rightSlot?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}

export function HUDFrame({
  children,
  serial,
  title,
  rightSlot,
  className,
  bodyClassName,
}: HUDFrameProps) {
  return (
    <div
      className={cn(
        'corner-tick relative flex h-full flex-col bg-bg-raised/30 backdrop-blur-sm',
        className,
      )}
    >
      {(serial || title || rightSlot) && (
        <header className="flex items-center justify-between border-b-hairline border-hairline px-4 py-2">
          <div className="flex items-center gap-3">
            {serial && (
              <MonoLabel size="2xs" tone="dim">
                {serial}
              </MonoLabel>
            )}
            {title && (
              <MonoLabel size="xs" tone="default" uppercase>
                {title}
              </MonoLabel>
            )}
          </div>
          {rightSlot && <div className="flex items-center gap-2">{rightSlot}</div>}
        </header>
      )}
      <div className={cn('flex-1 overflow-auto', bodyClassName)}>{children}</div>
    </div>
  );
}
