'use client';

import { useProfileStore, type HouseholdMember } from '@/stores/useProfileStore';
import { MonoLabel } from '@/components/cockpit';
import { cn } from '@/lib/utils';

const MEMBER_OPTIONS: { value: HouseholdMember; label: string; sub: string }[] = [
  { value: 'alone', label: '単身', sub: 'ALONE' },
  { value: 'adults', label: '成人のみ', sub: 'ADULTS' },
  { value: 'children', label: '子ども', sub: 'CHILDREN' },
  { value: 'infant', label: '乳幼児', sub: 'INFANT' },
  { value: 'elderly', label: '高齢者', sub: 'ELDERLY' },
  { value: 'care_needed', label: '要介護', sub: 'CARE NEEDED' },
  { value: 'pets', label: 'ペット', sub: 'PETS' },
];

export function HouseholdForm() {
  const household = useProfileStore((s) => s.household);
  const setHousehold = useProfileStore((s) => s.setHousehold);

  const toggle = (m: HouseholdMember) => {
    const cur = household.composition;
    if (cur.includes(m)) {
      setHousehold({ composition: cur.filter((x) => x !== m) });
    } else {
      setHousehold({ composition: [...cur, m] });
    }
  };

  return (
    <form className="flex flex-col gap-5" onSubmit={(e) => e.preventDefault()}>
      <header>
        <MonoLabel size="2xs" tone="dim">
          HOUSEHOLD PROFILE
        </MonoLabel>
        <h2 className="font-sans text-base text-ink mt-0.5">家族構成</h2>
        <p className="font-sans text-xs text-ink-mute mt-1 leading-relaxed">
          該当する人がいれば複数選択してください。対策候補が自動絞込みされます。
          <br />
          すべて任意・端末ローカル保存。
        </p>
      </header>

      <div className="grid grid-cols-2 gap-2">
        {MEMBER_OPTIONS.map((o) => {
          const selected = household.composition.includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => toggle(o.value)}
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

      <div className="flex items-center gap-2">
        <MonoLabel size="2xs" tone="dim">
          MEMBERS
        </MonoLabel>
        <input
          type="number"
          min={1}
          max={20}
          value={household.members_count ?? ''}
          onChange={(e) =>
            setHousehold({ members_count: e.target.value ? parseInt(e.target.value, 10) : null })
          }
          placeholder="3"
          className="w-16 font-mono text-mono-sm tabular-nums bg-bg-raised border-hairline border-hairline focus:border-accent outline-none rounded-cockpit px-2 py-1 text-ink"
        />
        <MonoLabel size="2xs" tone="dim">
          人世帯
        </MonoLabel>
      </div>
    </form>
  );
}
