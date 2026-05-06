'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, LogIn, AlertCircle } from 'lucide-react';

interface Props {
  next: string;
}

export function LoginForm({ next }: Props) {
  const router = useRouter();
  const [user, setUser] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user, password }),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.error ?? `HTTP ${r.status}`);
      }
      router.push(next);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  const inputCls =
    'w-full bg-bg-sunken border-hairline border-hairline px-3 py-2 rounded-cockpit text-sm text-ink placeholder:text-ink-dim focus:border-accent focus:outline-none';

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-3 border-hairline border-hairline bg-bg-raised/40 p-5 rounded-cockpit"
    >
      <label className="flex flex-col gap-1.5">
        <span className="text-xs text-ink-mute">ユーザー名</span>
        <input
          type="text"
          value={user}
          onChange={(e) => setUser(e.target.value)}
          autoComplete="username"
          required
          className={inputCls}
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs text-ink-mute">パスワード</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
          className={inputCls}
        />
      </label>
      <button
        type="submit"
        disabled={busy}
        className="mt-2 inline-flex items-center justify-center gap-2 border-hairline border-accent bg-accent-soft hover:bg-accent-dim disabled:opacity-50 px-4 py-2 rounded-cockpit text-sm text-accent transition-colors"
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <LogIn className="h-4 w-4" aria-hidden />
        )}
        ログイン
      </button>
      {error && (
        <div className="inline-flex items-start gap-2 text-xs text-scale-lg">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden />
          <span>{error}</span>
        </div>
      )}
    </form>
  );
}
