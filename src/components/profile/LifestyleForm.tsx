'use client';

import {
  useProfileStore,
  type WeekdayLocation,
  type LocationTypeTag,
} from '@/stores/useProfileStore';
import { MonoLabel } from '@/components/cockpit';
import { cn } from '@/lib/utils';

const LOCATION_OPTIONS: { value: WeekdayLocation; label: string; sub: string }[] = [
  { value: 'home', label: '在宅', sub: 'HOME' },
  { value: 'office', label: '職場', sub: 'OFFICE' },
  { value: 'school', label: '学校', sub: 'SCHOOL' },
  { value: 'mixed', label: '複合', sub: 'MIXED' },
];

const LOCATION_TYPE_OPTIONS: { value: LocationTypeTag; label: string; sub: string }[] = [
  { value: 'coastal', label: '海岸沿い', sub: 'COASTAL' },
  { value: 'inland', label: '内陸部', sub: 'INLAND' },
  { value: 'mountainous', label: '山間部', sub: 'MOUNTAINOUS' },
  { value: 'urban', label: '市街地', sub: 'URBAN' },
];

export function LifestyleForm() {
  const lifestyle = useProfileStore((s) => s.lifestyle);
  const setLifestyle = useProfileStore((s) => s.setLifestyle);

  return (
    <form className="flex flex-col gap-5" onSubmit={(e) => e.preventDefault()}>
      <header>
        <MonoLabel size="2xs" tone="dim">
          LIFESTYLE PROFILE
        </MonoLabel>
        <h2 className="font-sans text-base text-ink mt-0.5">生活パターン</h2>
        <p className="font-sans text-xs text-ink-mute mt-1 leading-relaxed">
          災害時に最初にいる場所と移動手段の有無を任意で。
        </p>
      </header>

      <div>
        <MonoLabel size="2xs" tone="dim" className="block mb-1.5">
          平日昼の主な居場所
        </MonoLabel>
        <div className="grid grid-cols-2 gap-2">
          {LOCATION_OPTIONS.map((o) => {
            const selected = lifestyle.weekday_location === o.value;
            return (
              <button
                key={o.value!}
                type="button"
                onClick={() => setLifestyle({ weekday_location: selected ? null : o.value })}
                className={cn(
                  'text-left border-hairline border-hairline px-3 py-2 rounded-cockpit transition-colors',
                  selected ? 'border-accent bg-accent-soft' : 'hover:border-ink-mute',
                )}
              >
                <div className="font-sans text-sm text-ink">{o.label}</div>
                <MonoLabel size="2xs" tone="dim">
                  {o.sub}
                </MonoLabel>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <MonoLabel size="2xs" tone="dim" className="block mb-1.5">
          自宅の地域種別 (複数選択可)
        </MonoLabel>
        <div className="grid grid-cols-2 gap-2">
          {LOCATION_TYPE_OPTIONS.map((o) => {
            const selected = lifestyle.location_types.includes(o.value);
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => {
                  const cur = lifestyle.location_types;
                  setLifestyle({
                    location_types: selected ? cur.filter((v) => v !== o.value) : [...cur, o.value],
                  });
                }}
                className={cn(
                  'text-left border-hairline border-hairline px-3 py-2 rounded-cockpit transition-colors',
                  selected ? 'border-accent bg-accent-soft' : 'hover:border-ink-mute',
                )}
              >
                <div className="font-sans text-sm text-ink">{o.label}</div>
                <MonoLabel size="2xs" tone="dim">
                  {o.sub}
                </MonoLabel>
              </button>
            );
          })}
        </div>
        <p className="mt-1.5 font-sans text-xs text-ink-dim leading-relaxed">
          海岸沿い→津波対策、山間部→土砂対策などが追加表示されます。
        </p>
      </div>

      <div>
        <MonoLabel size="2xs" tone="dim" className="block mb-1.5">
          自家用車
        </MonoLabel>
        <div className="flex gap-2">
          {(
            [
              { val: true, label: 'あり', sub: 'HAS CAR' },
              { val: false, label: 'なし', sub: 'NO CAR' },
            ] as const
          ).map((o) => {
            const selected = lifestyle.has_car === o.val;
            return (
              <button
                key={String(o.val)}
                type="button"
                onClick={() => setLifestyle({ has_car: selected ? null : o.val })}
                className={cn(
                  'border-hairline border-hairline px-3 py-2 rounded-cockpit transition-colors',
                  selected ? 'border-accent bg-accent-soft' : 'hover:border-ink-mute',
                )}
              >
                <div className="font-sans text-sm text-ink">{o.label}</div>
                <MonoLabel size="2xs" tone="dim">
                  {o.sub}
                </MonoLabel>
              </button>
            );
          })}
        </div>
      </div>
    </form>
  );
}
