import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ChevronRight, Plus } from 'lucide-react';
import { listRegistryEntries } from '@/lib/sonae/admin/registry';
import { inspectCacheBriefly } from '@/lib/sonae/admin/cacheInspect';
import { StatusBadge } from '@/components/admin/StatusBadge';

export const dynamic = 'force-dynamic';

export default async function PrefecturePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const all = listRegistryEntries().filter((m) => (m.prefecture_code ?? '') === code);
  if (!all.length) notFound();
  const prefecture = all[0]!.prefecture;

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1.5 text-xs text-ink-mute hover:text-ink w-fit"
      >
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
        都道府県一覧へ戻る
      </Link>

      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-sans text-2xl text-ink leading-tight">{prefecture}</h1>
          <p className="text-sm text-ink-mute mt-1">
            登録自治体 <span className="text-ink tabular-nums">{all.length}</span> 件 / コード{' '}
            <span className="text-ink font-mono">{code}</span>
          </p>
        </div>
        <Link
          href={`/admin/new?prefecture=${encodeURIComponent(prefecture)}&prefecture_code=${code}`}
          className="inline-flex items-center gap-1.5 border-hairline border-accent bg-accent-soft hover:bg-accent-dim px-3 py-1.5 rounded-cockpit text-sm text-accent transition-colors"
        >
          <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
          新規追加
        </Link>
      </header>

      <div className="border-hairline border-hairline rounded-cockpit overflow-hidden">
        <table className="w-full">
          <thead className="bg-bg-sunken text-xs text-ink-mute">
            <tr>
              <th className="text-left px-4 py-2.5 font-medium">自治体</th>
              <th className="text-left px-4 py-2.5 font-medium font-mono">code</th>
              <th className="text-left px-4 py-2.5 font-medium">PDF</th>
              <th className="text-left px-4 py-2.5 font-medium">OCR</th>
              <th className="text-left px-4 py-2.5 font-medium">解析結果</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {all.map((m) => {
              const c = inspectCacheBriefly(m.code);
              return (
                <tr
                  key={m.code}
                  className="border-t-hairline border-hairline hover:bg-bg-raised/40 transition-colors"
                >
                  <td className="px-4 py-3 text-ink">{m.name}</td>
                  <td className="px-4 py-3 text-ink-mute tabular-nums font-mono text-xs">
                    {m.code}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge ok={c.pdf} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge ok={c.ocr} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge ok={c.result} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/municipalities/${m.code}`}
                      className="inline-flex items-center gap-1 text-xs text-ink-mute hover:text-accent"
                    >
                      詳細
                      <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
