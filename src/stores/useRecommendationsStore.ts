'use client';

import { create } from 'zustand';
import type { NextActions } from '@/lib/sonae';

export type RecommendationsStatus = 'idle' | 'loading' | 'done' | 'error';

interface RecState {
  status: RecommendationsStatus;
  result: (NextActions & { meta?: any }) | null;
  error: string | null;
  generate: (
    code: string,
    name: string,
    profile: any,
    checklistState: {
      completed: string[];
      pending: string[];
      not_applicable: string[];
      unanswered: string[];
    },
  ) => Promise<void>;
  reset: () => void;
}

export const useRecommendationsStore = create<RecState>()((set) => ({
  status: 'idle',
  result: null,
  error: null,
  generate: async (code, name, profile, checklistState) => {
    set({ status: 'loading', error: null });
    try {
      const r = await fetch('/api/next-actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: { municipality_code: code, name },
          user_profile: profile,
          checklist_state: checklistState,
        }),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.error ?? `HTTP ${r.status}`);
      }
      const data = await r.json();
      set({ status: 'done', result: data });
    } catch (e: any) {
      set({ status: 'error', error: String(e?.message ?? e) });
    }
  },
  reset: () => set({ status: 'idle', result: null, error: null }),
}));
