import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { listRegistryEntries } from '@/lib/sonae/admin/registry';
import { inspectCache } from '@/lib/sonae/admin/cacheInspect';
import { CacheStatusPanel } from '@/components/admin/CacheStatusPanel';
import { DeleteMunicipalityButton } from '@/components/admin/DeleteMunicipalityButton';

export const dynamic = 'force-dynamic';

export default async function MunicipalityPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const muni = listRegistryEntries().find((m) => m.code === code);
  if (!muni) notFound();

  const status = inspectCache(code);

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={`/admin/prefectures/${muni.prefecture_code ?? ''}`}
        className="inline-flex items-center gap-1.5 text-xs text-ink-mute hover:text-ink w-fit"
      >
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
        {muni.prefecture} へ戻る
      </Link>

      <header className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs text-ink-mute">{muni.prefecture}</div>
          <h1 className="font-sans text-2xl text-ink leading-tight mt-0.5">{muni.name}</h1>
        </div>
        <DeleteMunicipalityButton code={muni.code} prefecture_code={muni.prefecture_code ?? ''} />
      </header>

      <CacheStatusPanel code={muni.code} initialStatus={status} />
    </div>
  );
}
