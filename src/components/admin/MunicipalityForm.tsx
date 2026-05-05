'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, ChevronDown, Loader2, Save } from 'lucide-react';
import { LocationPicker, type LocationPick } from './LocationPicker';

export interface MunicipalityFormValues {
  code: string;
  name: string;
  prefecture: string;
  prefecture_code: string;
  lat: string;
  lng: string;
  name_aliases: string;
  disaster_plan_url?: string;
  disaster_plan_label?: string;
  disaster_plan_page_url?: string;
}

interface Props {
  mode: 'create' | 'edit';
  initial: Partial<MunicipalityFormValues>;
  onAfterSubmit?: () => void;
}

const inputCls =
  'w-full bg-bg-sunken border-hairline border-hairline px-3 py-2 rounded-cockpit text-sm text-ink placeholder:text-ink-dim focus:border-accent focus:outline-none disabled:opacity-50';

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs text-ink-mute">{label}</span>
      {children}
      {hint && <span className="text-xs text-ink-dim">{hint}</span>}
    </label>
  );
}

export function MunicipalityForm({ mode, initial, onAfterSubmit }: Props) {
  const router = useRouter();
  const [v, setV] = useState<MunicipalityFormValues>({
    code: initial.code ?? '',
    name: initial.name ?? '',
    prefecture: initial.prefecture ?? '',
    prefecture_code: initial.prefecture_code ?? '',
    lat: initial.lat ?? '',
    lng: initial.lng ?? '',
    name_aliases: initial.name_aliases ?? '',
    disaster_plan_url: initial.disaster_plan_url ?? '',
    disaster_plan_label: initial.disaster_plan_label ?? '',
    disaster_plan_page_url: initial.disaster_plan_page_url ?? '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upd =
    (k: keyof MunicipalityFormValues) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setV((cur) => ({ ...cur, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const aliases = v.name_aliases
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const lat = v.lat ? Number(v.lat) : null;
      const lng = v.lng ? Number(v.lng) : null;
      if (lat !== null && (!Number.isFinite(lat) || lat < -90 || lat > 90)) {
        throw new Error('lat は -90〜90 の数値');
      }
      if (lng !== null && (!Number.isFinite(lng) || lng < -180 || lng > 180)) {
        throw new Error('lng は -180〜180 の数値');
      }
      const body = {
        code: v.code.trim(),
        name: v.name.trim(),
        prefecture: v.prefecture.trim(),
        prefecture_code: v.prefecture_code.trim(),
        lat,
        lng,
        name_aliases: aliases,
        disaster_plan_url: v.disaster_plan_url?.trim() || undefined,
        disaster_plan_label: v.disaster_plan_label?.trim() || undefined,
        disaster_plan_page_url: v.disaster_plan_page_url?.trim() || undefined,
      };

      const url =
        mode === 'create'
          ? '/api/admin/municipalities'
          : `/api/admin/municipalities/${encodeURIComponent(v.code)}`;
      const method = mode === 'create' ? 'POST' : 'PATCH';
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mode === 'create' ? body : { ...body, code: undefined }),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.error ?? `HTTP ${r.status}`);
      }
      router.refresh();
      if (mode === 'create') {
        router.push(`/admin/municipalities/${encodeURIComponent(v.code)}`);
      }
      onAfterSubmit?.();
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const onLocationPick = (pick: LocationPick) => {
    setV((cur) => ({
      ...cur,
      lat: pick.lat.toFixed(6),
      lng: pick.lng.toFixed(6),
      // 既存値が空のときだけ補完。手入力済の値を上書きしない。
      code: cur.code || (pick.code ?? ''),
      prefecture_code: cur.prefecture_code || (pick.prefecture_code ?? ''),
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {mode === 'create' && (
        <LocationPicker
          initialLat={v.lat ? Number(v.lat) : undefined}
          initialLng={v.lng ? Number(v.lng) : undefined}
          onPick={onLocationPick}
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="自治体コード (5桁)" hint="全国地方公共団体コード">
          <input
            type="text"
            inputMode="numeric"
            pattern="\d{5}"
            value={v.code}
            onChange={upd('code')}
            disabled={mode === 'edit'}
            required
            className={inputCls + ' font-mono'}
          />
        </Field>
        <Field label="自治体名" hint="例: 横須賀市">
          <input type="text" value={v.name} onChange={upd('name')} required className={inputCls} />
        </Field>
        <Field label="都道府県" hint="例: 神奈川県">
          <input
            type="text"
            value={v.prefecture}
            onChange={upd('prefecture')}
            required
            className={inputCls}
          />
        </Field>
        <Field label="都道府県コード (2桁)">
          <input
            type="text"
            inputMode="numeric"
            pattern="\d{2}"
            value={v.prefecture_code}
            onChange={upd('prefecture_code')}
            required
            className={inputCls + ' font-mono'}
          />
        </Field>
        <Field label="緯度 (lat)">
          <input
            type="text"
            inputMode="decimal"
            value={v.lat}
            onChange={upd('lat')}
            className={inputCls + ' font-mono'}
          />
        </Field>
        <Field label="経度 (lng)">
          <input
            type="text"
            inputMode="decimal"
            value={v.lng}
            onChange={upd('lng')}
            className={inputCls + ' font-mono'}
          />
        </Field>
      </div>

      <Field label="別名 (カンマ区切り)" hint="検索ヒットに使う表記揺れの吸収">
        <input
          type="text"
          value={v.name_aliases}
          onChange={upd('name_aliases')}
          placeholder="横須賀市, よこすか市, Yokosuka"
          className={inputCls}
        />
      </Field>

      <details className="border-hairline border-hairline rounded-cockpit p-3">
        <summary className="text-xs text-ink-mute cursor-pointer inline-flex items-center gap-1">
          <ChevronDown className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
          地域防災計画 PDF の pin (任意)
        </summary>
        <div className="mt-3 flex flex-col gap-3">
          <Field label="計画 PDF URL">
            <input
              type="url"
              value={v.disaster_plan_url}
              onChange={upd('disaster_plan_url')}
              className={inputCls}
            />
          </Field>
          <Field label="計画 PDF ラベル">
            <input
              type="text"
              value={v.disaster_plan_label}
              onChange={upd('disaster_plan_label')}
              className={inputCls}
            />
          </Field>
          <Field label="計画 PDF 掲載ページ URL">
            <input
              type="url"
              value={v.disaster_plan_page_url}
              onChange={upd('disaster_plan_page_url')}
              className={inputCls}
            />
          </Field>
        </div>
      </details>

      <div className="flex items-center justify-between gap-3">
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center gap-1.5 border-hairline border-accent bg-accent-soft hover:bg-accent-dim disabled:opacity-50 px-4 py-2 rounded-cockpit text-sm text-accent transition-colors"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Save className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          )}
          {mode === 'create' ? '登録' : '保存'}
        </button>
        {error && (
          <span className="inline-flex items-center gap-1.5 text-xs text-scale-lg">
            <AlertCircle className="h-4 w-4" aria-hidden />
            {error}
          </span>
        )}
      </div>
    </form>
  );
}
