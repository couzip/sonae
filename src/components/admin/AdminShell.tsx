'use client';

import { ReactNode, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Database,
  ExternalLink,
  Layers,
  LogOut,
  MapPin,
  Plus,
  Shield,
} from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
  icon: typeof MapPin;
  match: (path: string) => boolean;
}

const NAV: NavItem[] = [
  {
    href: '/admin',
    label: '都道府県',
    icon: MapPin,
    match: (p) => p === '/admin' || p.startsWith('/admin/prefectures'),
  },
  {
    href: '/admin/new',
    label: '新規登録',
    icon: Plus,
    match: (p) => p === '/admin/new',
  },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const onLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch('/api/admin/logout', { method: 'POST' });
    } finally {
      router.push('/admin/login');
      router.refresh();
    }
  };

  return (
    <div className="min-h-screen bg-bg text-ink flex">
      <aside className="w-56 shrink-0 border-r-hairline border-hairline bg-bg-sunken/60 flex flex-col">
        <div className="p-4 border-b-hairline border-hairline flex items-center gap-2">
          <div className="h-8 w-8 rounded-cockpit border-hairline border-hairline flex items-center justify-center text-accent bg-accent-soft">
            <Shield className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          </div>
          <div className="leading-tight">
            <div className="font-sans text-sm text-ink">Sonae</div>
            <div className="text-xs text-ink-dim">管理画面</div>
          </div>
        </div>

        <nav className="flex-1 p-2 flex flex-col gap-1">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = item.match(pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  'flex items-center gap-2 px-3 py-2 rounded-cockpit text-sm transition-colors',
                  active
                    ? 'bg-accent-soft text-accent'
                    : 'text-ink-mute hover:bg-bg-raised hover:text-ink',
                ].join(' ')}
              >
                <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-2 border-t-hairline border-hairline flex flex-col gap-1">
          <Link
            href="/"
            className="flex items-center gap-2 px-3 py-2 rounded-cockpit text-sm text-ink-mute hover:bg-bg-raised hover:text-ink transition-colors"
          >
            <ExternalLink className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            フロントを開く
          </Link>
          <button
            type="button"
            onClick={onLogout}
            disabled={loggingOut}
            className="flex items-center gap-2 px-3 py-2 rounded-cockpit text-sm text-ink-mute hover:bg-bg-raised hover:text-ink transition-colors disabled:opacity-50"
          >
            <LogOut className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            {loggingOut ? 'ログアウト中…' : 'ログアウト'}
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <div className="max-w-5xl mx-auto px-6 py-6">{children}</div>
      </main>
    </div>
  );
}

export function CacheLayerIcon({ layer, className }: { layer: string; className?: string }) {
  const cls = className ?? 'h-4 w-4';
  if (layer === 'discovery') return <MapPin className={cls} strokeWidth={1.75} aria-hidden />;
  if (layer === 'pdf') return <Database className={cls} strokeWidth={1.75} aria-hidden />;
  if (layer === 'ocr') return <Layers className={cls} strokeWidth={1.75} aria-hidden />;
  if (layer === 'result') return <Database className={cls} strokeWidth={1.75} aria-hidden />;
  return <Layers className={cls} strokeWidth={1.75} aria-hidden />;
}
