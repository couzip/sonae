'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  Check,
  Database,
  FileText,
  FolderOpen,
  Globe,
  Loader2,
  Pencil,
  Trash2,
  Type,
} from 'lucide-react';
import type { CacheStatus } from '@/lib/sonae/admin/cacheInspect';
import { DiscoveryEditDialog } from './DiscoveryEditDialog';
import { AdminResearchButton } from './AdminResearchButton';
import { TextCacheEditDialog } from './TextCacheEditDialog';

interface Props {
  code: string;
  initialStatus: CacheStatus;
  /**
   * registry に未登録 (cache-only) な自治体の場合 true。
   * 全削除すると admin の自治体一覧 (registry∪cache) からこの自治体が消えるので、
   * 完了後は親都道府県ページへ navigate する。
   */
  cacheOnly?: boolean;
  prefectureCode?: string;
}

type Layer = 'discovery' | 'pdf' | 'ocr' | 'result' | 'work';

const LAYER_META: Record<Layer, { label: string; Icon: typeof Globe; description: string }> = {
  discovery: {
    label: 'Discovery',
    Icon: Globe,
    description: 'PDF URL の探索結果 (編集で URL 上書き可)',
  },
  pdf: { label: 'PDF', Icon: FileText, description: 'ダウンロード済 PDF とメタデータ' },
  ocr: { label: 'OCR', Icon: Type, description: 'OCR 抽出 markdown' },
  result: { label: '解析結果', Icon: Database, description: '最終 Disaster Assessment' },
  work: { label: '作業ファイル', Icon: FolderOpen, description: '中間 PNG / 一時 markdown' },
};

function fmtBytes(n: number | undefined): string {
  if (n == null) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function fmtTime(s: string | undefined): string {
  if (!s) return '—';
  return new Date(s).toLocaleString('ja-JP');
}

export function CacheStatusPanel({
  code,
  initialStatus,
  cacheOnly = false,
  prefectureCode,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [discoveryEditOpen, setDiscoveryEditOpen] = useState(false);
  const [ocrEditOpen, setOcrEditOpen] = useState(false);
  const [resultEditOpen, setResultEditOpen] = useState(false);
  const [, startTransition] = useTransition();

  async function purge(layer: Layer | 'all', label: string) {
    if (!confirm(`${label} のキャッシュを削除します。よろしいですか?`)) return;
    setBusy(layer);
    setError(null);
    try {
      const url =
        layer === 'all'
          ? `/api/admin/cache/${encodeURIComponent(code)}`
          : `/api/admin/cache/${encodeURIComponent(code)}/${layer}`;
      const r = await fetch(url, { method: 'DELETE' });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.error ?? `HTTP ${r.status}`);
      }
      // 全削除 + cache-only な自治体は、削除すると admin 一覧から消えて
      // このページが 404 になる。親都道府県ページへ遷移する。
      if (layer === 'all' && cacheOnly && prefectureCode) {
        startTransition(() => {
          router.push(`/admin/prefectures/${prefectureCode}`);
          router.refresh();
        });
      } else {
        startTransition(() => router.refresh());
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="border-hairline border-hairline rounded-cockpit p-5 flex flex-col gap-4">
      <header className="flex items-start justify-between gap-3">
        <h2 className="font-sans text-lg text-ink">キャッシュ</h2>
        <button
          type="button"
          onClick={() => purge('all', '全層')}
          disabled={busy !== null}
          className="inline-flex items-center gap-1.5 text-xs border-hairline border-scale-lg/70 bg-scale-lg/10 hover:bg-scale-lg/20 disabled:opacity-50 px-3 py-1.5 rounded-cockpit text-scale-lg transition-colors"
        >
          {busy === 'all' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
          )}
          全削除
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {initialStatus.layers.map((layerStatus) => {
          const layer = layerStatus.layer as Layer;
          const meta = LAYER_META[layer];
          const Icon = meta.Icon;
          const exists = layerStatus.exists;
          return (
            <div
              key={layer}
              className="border-hairline border-hairline rounded-cockpit p-3 bg-bg-raised/30 flex flex-col gap-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className={[
                      'h-8 w-8 rounded-cockpit border-hairline border-hairline flex items-center justify-center shrink-0',
                      exists ? 'text-accent bg-accent-soft' : 'text-ink-dim',
                    ].join(' ')}
                  >
                    <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <div className="font-sans text-sm text-ink leading-tight">{meta.label}</div>
                    <div className="text-xs text-ink-dim leading-tight mt-0.5">
                      {meta.description}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {layer === 'discovery' && (
                    <button
                      type="button"
                      onClick={() => setDiscoveryEditOpen(true)}
                      className="inline-flex items-center gap-1 text-xs border-hairline border-hairline hover:border-accent px-2 py-1 rounded-cockpit text-ink-mute hover:text-accent transition-colors"
                      title="編集"
                    >
                      <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                    </button>
                  )}
                  {layer === 'ocr' && (
                    <button
                      type="button"
                      onClick={() => setOcrEditOpen(true)}
                      className="inline-flex items-center gap-1 text-xs border-hairline border-hairline hover:border-accent px-2 py-1 rounded-cockpit text-ink-mute hover:text-accent transition-colors"
                      title="OCR markdown を編集"
                    >
                      <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                    </button>
                  )}
                  {layer === 'result' && (
                    <button
                      type="button"
                      onClick={() => setResultEditOpen(true)}
                      className="inline-flex items-center gap-1 text-xs border-hairline border-hairline hover:border-accent px-2 py-1 rounded-cockpit text-ink-mute hover:text-accent transition-colors"
                      title="解析結果 JSON を編集"
                    >
                      <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => purge(layer, meta.label)}
                    disabled={!exists || busy !== null}
                    className="inline-flex items-center gap-1 text-xs border-hairline border-hairline hover:border-scale-lg disabled:opacity-30 px-2 py-1 rounded-cockpit text-ink-mute hover:text-scale-lg transition-colors"
                    title={`${meta.label} を削除`}
                  >
                    {busy === layer ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                    )}
                  </button>
                </div>
              </div>

              {exists ? (
                <ul className="text-xs text-ink-mute font-mono flex flex-col gap-0.5">
                  {layerStatus.files
                    .filter((f) => f.exists)
                    .map((f) => (
                      <li
                        key={f.path}
                        className="flex items-center justify-between gap-2 tabular-nums"
                      >
                        <span className="inline-flex items-center gap-1 min-w-0">
                          <Check
                            className="h-3 w-3 text-accent shrink-0"
                            strokeWidth={2}
                            aria-hidden
                          />
                          <span className="truncate">
                            {f.path.split(/[\\/]/).slice(-2).join('/')}
                          </span>
                        </span>
                        <span className="text-ink-dim shrink-0">
                          {fmtBytes(f.size_bytes)} / {fmtTime(f.mtime)}
                        </span>
                      </li>
                    ))}
                </ul>
              ) : (
                <div className="text-xs text-ink-dim">未生成</div>
              )}
            </div>
          );
        })}
      </div>

      {error && (
        <div className="inline-flex items-start gap-2 border-hairline border-scale-lg bg-scale-lg/10 p-3 rounded-cockpit text-xs text-scale-lg">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden />
          <span>{error}</span>
        </div>
      )}

      <div className="border-t-hairline border-hairline pt-4">
        <AdminResearchButton code={code} />
      </div>

      <DiscoveryEditDialog
        code={code}
        open={discoveryEditOpen}
        onClose={() => setDiscoveryEditOpen(false)}
      />

      <TextCacheEditDialog
        title="OCR markdown を編集"
        endpoint={`/api/admin/cache/${encodeURIComponent(code)}/ocr`}
        extract={(d: unknown) => (d as { markdown?: string } | null | undefined)?.markdown ?? ''}
        build={(text) => ({ markdown: text })}
        notice="保存すると解析結果キャッシュも自動で削除されます (再生成が必要)。"
        open={ocrEditOpen}
        onClose={() => setOcrEditOpen(false)}
      />

      <TextCacheEditDialog
        title="解析結果 JSON を編集"
        endpoint={`/api/admin/cache/${encodeURIComponent(code)}/result`}
        extract={(d: unknown) => (d ? JSON.stringify(d, null, 2) : '')}
        build={(text) => JSON.parse(text)}
        validate={(text) => {
          try {
            JSON.parse(text);
          } catch {
            throw new Error('JSON 構文エラー');
          }
        }}
        placeholder="{ ... }"
        open={resultEditOpen}
        onClose={() => setResultEditOpen(false)}
      />
    </section>
  );
}
