'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type ConstructionType = 'wood' | 'steel' | 'rc' | 'src' | null;
export type Ownership = 'owned' | 'rented' | null;
export type WeekdayLocation = 'home' | 'office' | 'school' | 'mixed' | null;
export type HouseholdMember =
  | 'alone'
  | 'adults'
  | 'children'
  | 'infant'
  | 'elderly'
  | 'care_needed'
  | 'pets';
export type LocationTypeTag = 'coastal' | 'inland' | 'mountainous' | 'urban';

export interface BuildingProfile {
  year_built: number | null;
  construction: ConstructionType;
  total_floors: number | null;
  living_floor: number | null;
  ownership: Ownership;
}

export interface HouseholdProfile {
  composition: HouseholdMember[];
  members_count: number | null;
}

export interface LifestyleProfile {
  weekday_location: WeekdayLocation;
  has_car: boolean | null;
  /** 自宅の地域種別 (海岸/内陸/山間部/都市)。複数可。 */
  location_types: LocationTypeTag[];
}

interface ProfileState {
  building: BuildingProfile;
  household: HouseholdProfile;
  lifestyle: LifestyleProfile;
  setBuilding: (b: Partial<BuildingProfile>) => void;
  setHousehold: (h: Partial<HouseholdProfile>) => void;
  setLifestyle: (l: Partial<LifestyleProfile>) => void;
  reset: () => void;
}

const emptyBuilding: BuildingProfile = {
  year_built: null,
  construction: null,
  total_floors: null,
  living_floor: null,
  ownership: null,
};
const emptyHousehold: HouseholdProfile = { composition: [], members_count: null };
const emptyLifestyle: LifestyleProfile = {
  weekday_location: null,
  has_car: null,
  location_types: [],
};

export const useProfileStore = create<ProfileState>()(
  persist(
    (set) => ({
      building: emptyBuilding,
      household: emptyHousehold,
      lifestyle: emptyLifestyle,
      setBuilding: (b) => set((s) => ({ building: { ...s.building, ...b } })),
      setHousehold: (h) => set((s) => ({ household: { ...s.household, ...h } })),
      setLifestyle: (l) => set((s) => ({ lifestyle: { ...s.lifestyle, ...l } })),
      reset: () =>
        set({ building: emptyBuilding, household: emptyHousehold, lifestyle: emptyLifestyle }),
    }),
    {
      name: 'sonae-profile',
      storage: createJSONStorage(() =>
        typeof window === 'undefined' ? (undefined as unknown as Storage) : localStorage,
      ),
    },
  ),
);
