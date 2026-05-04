'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type ChecklistItemState = 'unanswered' | 'done' | 'pending' | 'na';

interface ChecklistState {
  // key: `${municipality_code}:${item_id}` → state
  items: Record<string, ChecklistItemState>;
  set: (code: string, itemId: string, state: ChecklistItemState) => void;
  get: (code: string, itemId: string) => ChecklistItemState;
  countByCode: (code: string) => {
    completed: number;
    pending: number;
    na: number;
    unanswered: number;
  };
  partition: (
    code: string,
    itemIds: string[],
  ) => {
    completed: string[];
    pending: string[];
    not_applicable: string[];
    unanswered: string[];
  };
  reset: () => void;
}

const k = (code: string, itemId: string) => `${code}:${itemId}`;

export const useChecklistStore = create<ChecklistState>()(
  persist(
    (set, getStore) => ({
      items: {},
      set: (code, itemId, state) =>
        set((s) => ({ items: { ...s.items, [k(code, itemId)]: state } })),
      get: (code, itemId) => getStore().items[k(code, itemId)] ?? 'unanswered',
      countByCode: (code) => {
        const all = Object.entries(getStore().items).filter(([key]) => key.startsWith(`${code}:`));
        const counts = { completed: 0, pending: 0, na: 0, unanswered: 0 };
        for (const [, v] of all) {
          if (v === 'done') counts.completed++;
          else if (v === 'pending') counts.pending++;
          else if (v === 'na') counts.na++;
          else counts.unanswered++;
        }
        return counts;
      },
      partition: (code, itemIds) => {
        const out = {
          completed: [] as string[],
          pending: [] as string[],
          not_applicable: [] as string[],
          unanswered: [] as string[],
        };
        const items = getStore().items;
        for (const id of itemIds) {
          const v = items[k(code, id)] ?? 'unanswered';
          if (v === 'done') out.completed.push(id);
          else if (v === 'pending') out.pending.push(id);
          else if (v === 'na') out.not_applicable.push(id);
          else out.unanswered.push(id);
        }
        return out;
      },
      reset: () => set({ items: {} }),
    }),
    {
      name: 'sonae-checklist',
      storage: createJSONStorage(() =>
        typeof window === 'undefined' ? (undefined as unknown as Storage) : localStorage,
      ),
    },
  ),
);
