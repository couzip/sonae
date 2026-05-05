import Link from 'next/link';
import { ChevronRight, MapPin } from 'lucide-react';
import { listRegistryEntries } from '@/lib/sonae/admin/registry';
import { inspectCacheBriefly } from '@/lib/sonae/admin/cacheInspect';

export const dynamic = 'force-dynamic';

export default async function AdminHome() {
  const all = listRegistryEntries();
  const buckets = new Map<
    string,
    { prefecture: string; prefecture_code: string; total: number; cached: number }
  >();
  for (const m of all) {
    const key = m.prefecture_code ?? '';
    const existing = buckets.get(key);
    const b =
      existing ??
      { prefecture: m.prefecture, prefecture_code: m.prefecture_code ?? '', total: 0, cached: 0 };
    b.total += 1;
    const c = inspectCacheBriefly(m.code);
    if (c.result) b.cached += 1;
    buckets.set(key, b);
  }
  const rows = Array.from(buckets.values()).sort((a, b) =>
    a.prefecture_code.localeCompare(b.prefecture_code),
  );

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-sans text-2xl text-ink">都道府県一覧</h1>
        <p className="text-sm text-ink-mute">
          登録自治体 <span className="text-ink tabular-nums">{all.length}</span> 件 / 都道府県{' '}
          <span className="text-ink tabular-nums">{rows.length}</span> 件
        </p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {rows.map((r) => (
          <Link
            key={r.prefecture_code}
            href={`/admin/prefectures/${r.prefecture_code}`}
            className="group border-hairline border-hairline bg-bg-raised/40 hover:bg-bg-raised hover:border-accent rounded-cockpit p-4 flex items-start justify-between gap-3 transition-colors"
          >
            <div className="flex items-start gap-3 min-w-0">
              <div className="h-9 w-9 rounded-cockpit border-hairline border-hairline flex items-center justify-center text-ink-mute group-hover:text-accent shrink-0">
                <MapPin className="h-4 w-4" strokeWidth={1.75} aria-hidden />
              </div>
              <div className="min-w-0">
                <div className="font-sans text-base text-ink leading-tight">{r.prefecture}</div>
                <div className="text-xs text-ink-dim font-mono mt-0.5">{r.prefecture_code}</div>
                <div className="text-xs text-ink-mute mt-2 tabular-nums">
                  登録 {r.total} / 解析済 {r.cached}
                </div>
              </div>
            </div>
            <ChevronRight
              className="h-4 w-4 text-ink-dim group-hover:text-accent shrink-0 mt-1"
              strokeWidth={1.75}
              aria-hidden
            />
          </Link>
        ))}
      </div>
    </div>
  );
}
