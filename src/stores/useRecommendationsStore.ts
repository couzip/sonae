'use client';

import { create } from 'zustand';
import type { NextActions, NextActionsInput } from '@/lib/sonae';

export type RecommendationsStatus = 'idle' | 'loading' | 'done' | 'error';

type UserProfile = NextActionsInput['user_profile'];
type ChecklistState = NextActionsInput['checklist_state'];

interface RecState {
  code: string | null;
  status: RecommendationsStatus;
  result: NextActions | null;
  error: string | null;
  generate: (
    code: string,
    name: string,
    profile: UserProfile,
    checklistState: ChecklistState,
  ) => Promise<void>;
  reset: () => void;
}

let requestSeq = 0;

export const useRecommendationsStore = create<RecState>()((set) => ({
  code: null,
  status: 'idle',
  result: null,
  error: null,
  generate: async (code, name, profile, checklistState) => {
    const seq = ++requestSeq;
    set({ code, status: 'loading', result: null, error: null });
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
      if (seq !== requestSeq) return;
      set({ status: 'done', result: data });
    } catch (e) {
      if (seq !== requestSeq) return;
      set({ status: 'error', error: e instanceof Error ? e.message : String(e) });
    }
  },
  reset: () => {
    requestSeq++;
    set({ code: null, status: 'idle', result: null, error: null });
  },
}));
