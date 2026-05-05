'use client';

import { useProfileStore, type ConstructionType, type Ownership } from '@/stores/useProfileStore';
import { MonoLabel, HairlineDivider } from '@/components/cockpit';
import { cn } from '@/lib/utils';

const CONSTRUCTIONS: { value: ConstructionType; label: string; sub: string }[] = [
  { value: 'wood', label: '木造', sub: 'WOOD' },
  { value: 'steel', label: '鉄骨', sub: 'STEEL' },
  { value: 'rc', label: 'RC', sub: 'REINFORCED CONCRETE' },
  { value: 'src', label: 'SRC', sub: 'STEEL-REINFORCED CONCRETE' },
];

const OWNERSHIPS: { value: Ownership; label: string }[] = [
  { value: 'owned', label: '所有' },
  { value: 'rented', label: '賃貸' },
];

export function BuildingForm() {
  const building = useProfileStore((s) => s.building);
  const setBuilding = useProfileStore((s) => s.setBuilding);

  return (
    <form className="flex flex-col gap-5" onSubmit={(e) => e.preventDefault()}>
      <header>
        <MonoLabel size="2xs" tone="dim">
          BUILDING PROFILE
        </MonoLabel>
        <h2 className="font-sans text-base text-ink mt-0.5">建物情報を入れて備えを最適化</h2>
        <p className="font-sans text-xs text-ink-mute mt-1 leading-relaxed">
          リサーチ完了後の対策候補がより精度高く絞り込まれます。
        </p>
      </header>

      <HairlineDivider variant="dashed" />

      {/* 築年 */}
      <FieldGroup label="YEAR BUILT" sub="築年(西暦)">
        <input
          type="number"
          min={1900}
          max={2030}
          value={building.year_built ?? ''}
          onChange={(e) =>
            setBuilding({ year_built: e.target.value ? parseInt(e.target.value, 10) : null })
          }
          placeholder="1985"
          className="w-32 font-mono text-mono-sm tabular-nums bg-bg-raised border-hairline border-hairline focus:border-accent outline-none rounded-cockpit px-2 py-1 text-ink"
        />
      </FieldGroup>

      {/* 構造 */}
      <FieldGroup label="CONSTRUCTION" sub="構造">
        <div className="grid grid-cols-2 gap-2">
          {CONSTRUCTIONS.map((c) => (
            <button
              key={c.value!}
              type="button"
              onClick={() =>
                setBuilding({ construction: building.construction === c.value ? null : c.value })
              }
              className={cn(
                'text-left border-hairline border-hairline px-2 py-1.5 rounded-cockpit transition-colors',
                building.construction === c.value
                  ? 'border-accent bg-accent-soft'
                  : 'hover:border-ink-mute',
              )}
            >
              <div className="font-sans text-sm text-ink">{c.label}</div>
              <MonoLabel size="2xs" tone="dim">
                {c.sub}
              </MonoLabel>
            </button>
          ))}
        </div>
      </FieldGroup>

      {/* 階数 */}
      <FieldGroup label="FLOORS" sub="階数 (建物全体 / 居住階)">
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            max={50}
            value={building.total_floors ?? ''}
            onChange={(e) =>
              setBuilding({ total_floors: e.target.value ? parseInt(e.target.value, 10) : null })
            }
            placeholder="3"
            className="w-16 font-mono text-mono-sm tabular-nums bg-bg-raised border-hairline border-hairline focus:border-accent outline-none rounded-cockpit px-2 py-1 text-ink"
          />
          <MonoLabel size="2xs" tone="dim">
            階建
          </MonoLabel>
          <span className="text-ink-dim mx-2">/</span>
          <input
            type="number"
            min={1}
            max={50}
            value={building.living_floor ?? ''}
            onChange={(e) =>
              setBuilding({ living_floor: e.target.value ? parseInt(e.target.value, 10) : null })
            }
            placeholder="2"
            className="w-16 font-mono text-mono-sm tabular-nums bg-bg-raised border-hairline border-hairline focus:border-accent outline-none rounded-cockpit px-2 py-1 text-ink"
          />
          <MonoLabel size="2xs" tone="dim">
            階に居住
          </MonoLabel>
        </div>
      </FieldGroup>

      {/* 所有形態 */}
      <FieldGroup label="OWNERSHIP" sub="所有形態">
        <div className="flex gap-2">
          {OWNERSHIPS.map((o) => (
            <button
              key={o.value!}
              type="button"
              onClick={() =>
                setBuilding({ ownership: building.ownership === o.value ? null : o.value })
              }
              className={cn(
                'border-hairline border-hairline px-3 py-1.5 rounded-cockpit transition-colors',
                building.ownership === o.value
                  ? 'border-accent bg-accent-soft'
                  : 'hover:border-ink-mute',
              )}
            >
              <span className="font-sans text-sm text-ink">{o.label}</span>
            </button>
          ))}
        </div>
      </FieldGroup>
    </form>
  );
}

function FieldGroup({
  label,
  sub,
  children,
}: {
  label: string;
  sub: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline gap-2">
        <MonoLabel size="2xs" tone="dim">
          {label}
        </MonoLabel>
        <span className="font-sans text-xs text-ink-mute">{sub}</span>
      </div>
      {children}
    </div>
  );
}
