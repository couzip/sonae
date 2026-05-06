'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Loader2, Save, X } from 'lucide-react';

interface Props {
  title: string;
  /** GET / PUT 先のエンドポイント */
  endpoint: string;
  /** GET レスポンスから本文を抽出 */
  extract: (data: unknown) => string;
  /** PUT body を組み立てる */
  build: (text: string) => unknown;
  /** body 適用前のローカル検証 (例: JSON parse)。throw で error 表示 */
  validate?: (text: string) => void;
  /** 保存後に親に通知 (cache 状況再描画など) */
  onSaved?: () => void;
  open: boolean;
  onClose: () => void;
  /** textarea の placeholder */
  placeholder?: string;
  /** 本文上に出す注意書き (例: 「保存すると result cache が無効化されます」) */
  notice?: string;
}

export function TextCacheEditDialog({
  title,
  endpoint,
  extract,
  build,
  validate,
  onSaved,
  open,
  onClose,
  placeholder,
  notice,
}: Props) {
  const router = useRouter();
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setLoading(true);
    fetch(endpoint)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => setText(extract(data) ?? ''))
      .catch(() => setError('読み込みに失敗しました'))
      .finally(() => setLoading(false));
  }, [open, endpoint, extract]);

  if (!open) return null;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (validate) validate(text);
      const r = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(build(text)),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.error ?? `HTTP ${r.status}`);
      }
      router.refresh();
      onSaved?.();
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
        className="w-full max-w-4xl bg-bg-raised border-hairline border-hairline rounded-cockpit p-5 flex flex-col gap-4 max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between">
          <h2 className="font-sans text-lg text-ink">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-ink-mute hover:text-ink p-1"
            aria-label="閉じる"
          >
            <X className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          </button>
        </header>

        {notice && (
          <div className="text-xs text-ink-mute border-l-2 border-accent pl-2">{notice}</div>
        )}

        {loading ? (
          <div className="py-12 text-center text-sm text-ink-mute inline-flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            読み込み中
          </div>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-3 min-h-0 flex-1">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={placeholder}
              className="flex-1 w-full bg-bg-sunken border-hairline border-hairline px-3 py-2 rounded-cockpit text-xs font-mono text-ink resize-none focus:border-accent focus:outline-none min-h-[300px]"
              spellCheck={false}
            />
            <div className="flex items-center justify-between gap-3">
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
