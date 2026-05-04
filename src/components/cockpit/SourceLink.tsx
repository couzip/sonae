'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { MonoLabel } from './MonoLabel';

interface SourceLinkProps {
  index: number;
  title: string;
  page?: number | null;
  edition?: string | null;
  url?: string | null;
  className?: string;
}

export function SourceLink({ index, title, page, edition, url, className }: SourceLinkProps) {
  const [open, setOpen] = useState(false);

  return (
    <span className={cn('relative inline-flex', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setOpen(false)}
        className="inline-flex h-4 min-w-4 items-center justify-center border-hairline border-hairline text-ink-mute hover:text-accent hover:border-accent transition-colors rounded-cockpit"
        aria-label={`出典 ${index}: ${title}`}
      >
        <MonoLabel size="2xs" tone="default" className="px-1">
          [{index}]
        </MonoLabel>
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute left-1/2 top-full z-50 mt-1 w-64 -translate-x-1/2 corner-tick border-hairline border-hairline-strong bg-bg-sunken p-2 text-left rounded-cockpit shadow-xl"
        >
          <MonoLabel size="2xs" tone="dim" className="block mb-1">
            出典 [{index}]
          </MonoLabel>
          <span className="block font-sans text-xs text-ink leading-snug">{title}</span>
          {(page || edition) && (
            <span className="mt-1 block">
              <MonoLabel size="2xs" tone="mute">
                {page && `p.${page}`}
                {page && edition && ' · '}
                {edition}
              </MonoLabel>
            </span>
          )}
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 block truncate text-mono-2xs text-accent hover:underline font-mono"
            >
              {url} ↗
            </a>
          )}
        </span>
      )}
    </span>
  );
}
