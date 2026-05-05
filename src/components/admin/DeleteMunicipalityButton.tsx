'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Loader2, Trash2 } from 'lucide-react';

export function DeleteMunicipalityButton({
  code,
  prefecture_code,
}: {
  code: string;
  prefecture_code: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handle = async () => {
    if (!confirm(`code=${code} を registry から削除します (cache は残ります)。よろしいですか?`))
      return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/admin/municipalities/${encodeURIComponent(code)}`, {
        method: 'DELETE',
      });
      if (!r.ok && r.status !== 204) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.error ?? `HTTP ${r.status}`);
      }
      router.push(`/admin/prefectures/${prefecture_code}`);
    } catch (e: any) {
      setError(String(e?.message ?? e));
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handle}
        disabled={busy}
        className="inline-flex items-center gap-1.5 text-xs border-hairline border-scale-lg/70 bg-scale-lg/10 hover:bg-scale-lg/20 disabled:opacity-50 px-3 py-1.5 rounded-cockpit text-scale-lg transition-colors"
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        ) : (
          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
        )}
        登録から削除
      </button>
      {error && (
        <span className="inline-flex items-center gap-1 text-xs text-scale-lg">
          <AlertCircle className="h-3.5 w-3.5" aria-hidden />
          {error}
        </span>
      )}
    </div>
  );
}
