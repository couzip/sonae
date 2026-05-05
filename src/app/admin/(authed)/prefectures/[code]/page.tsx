import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ChevronRight, Plus } from 'lucide-react';
import { groupAdminMunicipalitiesByPrefecture } from '@/lib/sonae/admin/aggregate';
import { PREFECTURE_BY_CODE } from '@/lib/sonae/admin/prefectures';
import { StatusBadge } from '@/components/admin/StatusBadge';

export const dynamic = 'force-dynamic';

export default async function PrefecturePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const bucket = groupAdminMunicipalitiesByPrefecture().find(
    (b) => b.prefecture_code === code,
  );
  // bucket 不在 = 都道府県に登録/cache が 1 件も無い状態。code が JIS X 0402 県コード
  // (01-47) であれば空状態を表示する。それ以外 (= 不明な code) のみ 404 にする。
  const prefName = PREFECTURE_BY_CODE[code];
  if (!bucket && !prefName) notFound();

  const prefectureLabel = bucket?.prefecture ?? prefName ?? '';
  const municipalities = bucket?.municipalities ?? [];
  const cachedCount = bucket?.cached ?? 0;

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
          <h1 className="font-sans text-2xl text-ink leading-tight">{prefectureLabel}</h1>
          <p className="text-sm text-ink-mute mt-1">
            自治体 <span className="text-ink tabular-nums">{municipalities.length}</span> 件 /
            解析済 <span className="text-ink tabular-nums">{cachedCount}</span> 件
          </p>
        </div>
        <Link
          href={`/admin/new?prefecture=${encodeURIComponent(prefectureLabel)}&prefecture_code=${code}`}
          className="inline-flex items-center gap-1.5 border-hairline border-accent bg-accent-soft hover:bg-accent-dim px-3 py-1.5 rounded-cockpit text-sm text-accent transition-colors"
        >
          <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
          新規追加
        </Link>
      </header>

      {municipalities.length === 0 ? (
        <div className="border-hairline border-hairline rounded-cockpit p-6 text-sm text-ink-mute text-center">
          この都道府県に登録/解析済の自治体はありません。
          <br />
          フロントから自治体をリサーチするか、上の「新規追加」から登録してください。
        </div>
      ) : (
        <div className="border-hairline border-hairline rounded-cockpit overflow-hidden">
          <table className="w-full">
            <thead className="bg-bg-sunken text-xs text-ink-mute">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">自治体</th>
                <th className="text-left px-4 py-2.5 font-medium">PDF</th>
                <th className="text-left px-4 py-2.5 font-medium">OCR</th>
                <th className="text-left px-4 py-2.5 font-medium">解析結果</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {municipalities.map((m) => (
                <tr
                  key={m.code}
                  className="border-t-hairline border-hairline hover:bg-bg-raised/40 transition-colors"
                >
                  <td className="px-4 py-3 text-ink">
                    <div className="flex items-center gap-2">
                      <span>{m.name}</span>
                      {!m.in_registry && (
                        <span
                          className="text-[10px] uppercase tracking-cockpit text-ink-dim border-hairline border-hairline px-1.5 py-0.5 rounded-cockpit"
                          title="registry 未登録 (キャッシュからの自動検出)"
                        >
                          未登録
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge ok={m.cache.pdf} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge ok={m.cache.ocr} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge ok={m.cache.result} />
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
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
