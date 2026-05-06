import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { findAdminMunicipality } from '@/lib/sonae/admin/aggregate';
import { inspectCache } from '@/lib/sonae/admin/cacheInspect';
import { CacheStatusPanel } from '@/components/admin/CacheStatusPanel';
import { DeleteMunicipalityButton } from '@/components/admin/DeleteMunicipalityButton';

export const dynamic = 'force-dynamic';

export default async function MunicipalityPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const muni = findAdminMunicipality(code);
  if (!muni) notFound();

  const status = inspectCache(code);

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={`/admin/prefectures/${muni.prefecture_code}`}
        className="inline-flex items-center gap-1.5 text-xs text-ink-mute hover:text-ink w-fit"
      >
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
        {muni.prefecture} へ戻る
      </Link>

      <header className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs text-ink-mute">{muni.prefecture}</div>
          <h1 className="font-sans text-2xl text-ink leading-tight mt-0.5 flex items-center gap-2">
            <span>{muni.name}</span>
            {!muni.in_registry && (
              <span
                className="text-[10px] uppercase tracking-cockpit text-ink-dim border-hairline border-hairline px-1.5 py-0.5 rounded-cockpit"
                title="registry 未登録 (キャッシュからの自動検出)"
              >
                未登録
              </span>
            )}
          </h1>
        </div>
        {muni.in_registry && (
          <DeleteMunicipalityButton code={muni.code} prefecture_code={muni.prefecture_code} />
        )}
      </header>

      <CacheStatusPanel
        code={muni.code}
        initialStatus={status}
        cacheOnly={!muni.in_registry}
        prefectureCode={muni.prefecture_code}
      />
    </div>
  );
}
