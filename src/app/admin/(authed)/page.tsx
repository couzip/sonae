import Link from 'next/link';
import { ChevronRight, MapPin } from 'lucide-react';
import { groupAdminMunicipalitiesByPrefecture } from '@/lib/sonae/admin/aggregate';

export const dynamic = 'force-dynamic';

export default async function AdminHome() {
  const buckets = groupAdminMunicipalitiesByPrefecture();
  const totalMunis = buckets.reduce((acc, b) => acc + b.municipalities.length, 0);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-sans text-2xl text-ink">都道府県一覧</h1>
        <p className="text-sm text-ink-mute">
          自治体 <span className="text-ink tabular-nums">{totalMunis}</span> 件 / 都道府県{' '}
          <span className="text-ink tabular-nums">{buckets.length}</span> 件
        </p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {buckets.map((b) => (
          <Link
            key={b.prefecture_code}
            href={`/admin/prefectures/${b.prefecture_code}`}
            className="group border-hairline border-hairline bg-bg-raised/40 hover:bg-bg-raised hover:border-accent rounded-cockpit p-4 flex items-start justify-between gap-3 transition-colors"
          >
            <div className="flex items-start gap-3 min-w-0">
              <div className="h-9 w-9 rounded-cockpit border-hairline border-hairline flex items-center justify-center text-ink-mute group-hover:text-accent shrink-0">
                <MapPin className="h-4 w-4" strokeWidth={1.75} aria-hidden />
              </div>
              <div className="min-w-0">
                <div className="font-sans text-base text-ink leading-tight">{b.prefecture}</div>
                <div className="text-xs text-ink-mute mt-2 tabular-nums">
                  自治体 {b.municipalities.length} 件 / 解析済 {b.cached} 件
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
