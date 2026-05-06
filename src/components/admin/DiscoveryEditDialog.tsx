'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Loader2, Save, X } from 'lucide-react';

interface Source {
  pdf_url: string;
  page_url?: string;
  pdf_label: string;
  section_hint?: string;
}

interface Props {
  code: string;
  open: boolean;
  onClose: () => void;
}

export function DiscoveryEditDialog({ code, open, onClose }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [v, setV] = useState<Source>({
    pdf_url: '',
    page_url: '',
    pdf_label: '',
    section_hint: '被害想定',
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setLoading(true);
    fetch(`/api/admin/cache/${encodeURIComponent(code)}/discovery`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: Source | null) => {
        if (data) {
          setV({
            pdf_url: data.pdf_url ?? '',
            page_url: data.page_url ?? '',
            pdf_label: data.pdf_label ?? '',
            section_hint: data.section_hint ?? '被害想定',
          });
        } else {
          setV({ pdf_url: '', page_url: '', pdf_label: '', section_hint: '被害想定' });
        }
      })
      .catch(() => setError('読み込みに失敗しました'))
      .finally(() => setLoading(false));
  }, [code, open]);

  if (!open) return null;

  const inputCls =
    'w-full bg-bg-sunken border-hairline border-hairline px-3 py-2 rounded-cockpit text-sm text-ink placeholder:text-ink-dim focus:border-accent focus:outline-none';

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const r = await fetch(`/api/admin/cache/${encodeURIComponent(code)}/discovery`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pdf_url: v.pdf_url.trim(),
          page_url: v.page_url?.trim() || undefined,
          pdf_label: v.pdf_label.trim() || decodeURIComponent(v.pdf_url.split('/').pop() ?? ''),
          section_hint: v.section_hint?.trim() || undefined,
        }),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.error ?? `HTTP ${r.status}`);
      }
      router.refresh();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-bg/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-bg-raised border-hairline border-hairline rounded-cockpit p-5 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between">
          <div>
            <h2 className="font-sans text-lg text-ink">Discovery キャッシュを編集</h2>
            <p className="text-xs text-ink-mute mt-0.5">
              PDF URL を上書きすると、PDF / OCR / 解析結果のキャッシュが自動で無効化されます。
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-ink-mute hover:text-ink p-1"
            aria-label="閉じる"
          >
            <X className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          </button>
        </header>

        {loading ? (
          <div className="py-8 text-center text-sm text-ink-mute inline-flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            読み込み中
          </div>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-ink-mute">PDF URL (必須)</span>
              <input
                type="url"
                value={v.pdf_url}
                onChange={(e) => setV((c) => ({ ...c, pdf_url: e.target.value }))}
                placeholder="https://www.city.example.jp/.../disaster_plan.pdf"
                required
                className={inputCls + ' font-mono'}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-ink-mute">掲載ページ URL (任意)</span>
              <input
                type="url"
                value={v.page_url ?? ''}
                onChange={(e) => setV((c) => ({ ...c, page_url: e.target.value }))}
                placeholder="https://www.city.example.jp/bousai/index.html"
                className={inputCls + ' font-mono'}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-ink-mute">PDF ラベル (任意)</span>
              <input
                type="text"
                value={v.pdf_label}
                onChange={(e) => setV((c) => ({ ...c, pdf_label: e.target.value }))}
                placeholder="例: 横須賀市地域防災計画 本編"
                className={inputCls}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-ink-mute">セクションヒント (任意、デフォルト: 被害想定)</span>
              <input
                type="text"
                value={v.section_hint ?? ''}
                onChange={(e) => setV((c) => ({ ...c, section_hint: e.target.value }))}
                className={inputCls}
              />
            </label>

            <div className="flex items-center justify-between gap-3 mt-2">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 border-hairline border-accent bg-accent-soft hover:bg-accent-dim disabled:opacity-50 px-4 py-2 rounded-cockpit text-sm text-accent transition-colors"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Save className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                )}
                保存
              </button>
              {error && (
                <span className="inline-flex items-center gap-1.5 text-xs text-scale-lg">
                  <AlertCircle className="h-4 w-4" aria-hidden />
                  {error}
                </span>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
