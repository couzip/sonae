'use client';

import { create } from 'zustand';

export type Phase = 'pick' | 'research' | 'grid' | 'detail' | 'actions';

export interface SelectedDisaster {
  jpType: string;
  enumType: string;
}

interface FlowState {
  phase: Phase;
  selectedDisaster: SelectedDisaster | null;
  setPhase: (phase: Phase) => void;
  openDisaster: (sel: SelectedDisaster) => void;
  reset: () => void;
}

export const useFlowStore = create<FlowState>()((set) => ({
  phase: 'pick',
  selectedDisaster: null,
  setPhase: (phase) => set({ phase }),
  openDisaster: (sel) => set({ phase: 'detail', selectedDisaster: sel }),
  reset: () => set({ phase: 'pick', selectedDisaster: null }),
}));
