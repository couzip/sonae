'use client';

import { useMemo } from 'react';
import type { Countermeasure } from '@/lib/sonae/client/countermeasures-filter';
import { ChecklistItem } from './ChecklistItem';

interface ChecklistGroupProps {
  items: Countermeasure[];
  municipalityCode: string;
  groupBy?: 'category' | 'disaster_group';
}

const DISASTER_GROUP_LABEL: Record<string, string> = {
  earthquake: '地震',
  tsunami: '津波',
  flood: '水害',
  inland_flood: '内水氾濫',
  landslide: '土砂',
  volcanic: '火山',
  storm: '暴風・台風',
  urban_fire: '火災延焼',
  common: '共通',
};

export function ChecklistGroup({
  items,
  municipalityCode,
  groupBy = 'disaster_group',
}: ChecklistGroupProps) {
  const grouped = useMemo(() => {
    const m = new Map<string, Countermeasure[]>();
    for (const it of items) {
      const k = groupBy === 'category' ? it.category : it.disaster_group;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(it);
    }
    return Array.from(m.entries());
  }, [items, groupBy]);

  if (!items.length) {
    return <div className="py-8 text-center text-sm text-ink-mute">該当する対策がありません</div>;
  }

  return (
    <div className="flex flex-col gap-5">
      {grouped.map(([key, list]) => (
        <section key={key}>
          <header className="flex items-baseline gap-2 mb-2">
            <h4 className="font-sans text-sm text-ink">
              {groupBy === 'disaster_group' ? (DISASTER_GROUP_LABEL[key] ?? key) : key}
            </h4>
            <span className="text-xs text-ink-dim tabular-nums">{list.length}</span>
          </header>
          <ul className="flex flex-col gap-1.5">
            {list.map((it) => (
              <ChecklistItem key={it.id} item={it} municipalityCode={municipalityCode} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
