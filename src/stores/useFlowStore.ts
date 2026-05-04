'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type Phase = 'pick' | 'research' | 'grid' | 'detail' | 'actions';

export type DisasterCategory =
  | 'earthquake'
  | 'tsunami'
  | 'flood'
  | 'inland_flood'
  | 'storm'
  | 'heavy_rain'
  | 'landslide'
  | 'volcanic'
  | 'tornado'
  | 'storm_surge'
  | 'urban_fire'
  | 'nuclear'
  | 'transport';

export interface SelectedDisaster {
  jpType: string; // パイプライン出力の生の日本語名 (例: "地震")
  enumType: string; // 内部 enum 名 (例: "earthquake")
}

interface FlowState {
  phase: Phase;
  selectedDisaster: SelectedDisaster | null;
  setPhase: (phase: Phase) => void;
  openDisaster: (sel: SelectedDisaster) => void;
  reset: () => void;
}

export const useFlowStore = create<FlowState>()(
  persist(
    (set) => ({
      phase: 'pick',
      selectedDisaster: null,
      setPhase: (phase) => set({ phase }),
      openDisaster: (sel) => set({ phase: 'detail', selectedDisaster: sel }),
      reset: () => set({ phase: 'pick', selectedDisaster: null }),
    }),
    {
      name: 'sonae-flow',
      storage: createJSONStorage(() =>
        typeof window === 'undefined' ? (undefined as unknown as Storage) : sessionStorage,
      ),
      partialize: (state) => ({ phase: state.phase, selectedDisaster: state.selectedDisaster }),
    },
  ),
);
