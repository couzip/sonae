'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface PickedLocation {
  lat: number;
  lng: number;
  address: string;
  source: 'gps' | 'address' | 'click';
}

export interface MunicipalityInfo {
  code: string;
  name: string;
  prefecture: string;
}

interface LocationState {
  picked: PickedLocation | null;
  municipality: MunicipalityInfo | null;
  isLooking: boolean;
  error: string | null;
  setPicked: (p: PickedLocation) => void;
  setMunicipality: (m: MunicipalityInfo) => void;
  setLooking: (v: boolean) => void;
  setError: (e: string | null) => void;
  reset: () => void;
}

export const useLocationStore = create<LocationState>()(
  persist(
    (set) => ({
      picked: null,
      municipality: null,
      isLooking: false,
      error: null,
      setPicked: (picked) => set({ picked, error: null }),
      setMunicipality: (municipality) => set({ municipality, error: null }),
      setLooking: (isLooking) => set({ isLooking }),
      setError: (error) => set({ error, isLooking: false }),
      reset: () => set({ picked: null, municipality: null, error: null, isLooking: false }),
    }),
    {
      name: 'sonae-location',
      storage: createJSONStorage(() =>
        typeof window === 'undefined' ? (undefined as unknown as Storage) : sessionStorage,
      ),
      partialize: (s) => ({ picked: s.picked, municipality: s.municipality }),
    },
  ),
);
