import { describe, it, expect } from 'vitest';
import {
  filterByDisaster,
  filterByProfile,
  type Countermeasure,
  type ProfileForFilter,
} from './countermeasures-filter';

function cm(partial: Partial<Countermeasure> & { id: string }): Countermeasure {
  const base: Countermeasure = {
    id: partial.id,
    category: '物理対策',
    disaster_group: 'earthquake',
    label: partial.id,
    applicable_disasters: ['earthquake'],
    applicability: {
      ownership: ['owned', 'rented'],
      building_type: ['any'],
      has_member: ['any'],
      location_type: ['any'],
    },
    effort: { time: 'low', cost: 'low', skill: 'low' },
    impact: 'medium',
  };
  return { ...base, ...partial };
}

describe('filterByDisaster', () => {
  const items: Countermeasure[] = [
    cm({ id: 'eq1', applicable_disasters: ['earthquake'] }),
    cm({ id: 'fl1', disaster_group: 'flood', applicable_disasters: ['flood'] }),
    cm({ id: 'cm1', disaster_group: 'common', applicable_disasters: ['earthquake', 'flood'] }),
    cm({ id: 'ts1', disaster_group: 'tsunami', applicable_disasters: ['tsunami'] }),
  ];

  it('with selected disaster, returns only that disaster + common', () => {
    const out = filterByDisaster(items, [], 'earthquake');
    expect(out.map((i) => i.id).sort()).toEqual(['cm1', 'eq1']);
  });

  it('without selected disaster, returns intersection with detected + common', () => {
    const out = filterByDisaster(items, ['earthquake', 'flood']);
    expect(out.map((i) => i.id).sort()).toEqual(['cm1', 'eq1', 'fl1']);
  });

  it('common items always pass even when no detected disaster matches', () => {
    const out = filterByDisaster(items, ['nonexistent']);
    expect(out.map((i) => i.id)).toEqual(['cm1']);
  });

  it('empty items returns empty', () => {
    expect(filterByDisaster([] as Countermeasure[], ['earthquake'])).toEqual([]);
  });
});

describe('filterByProfile', () => {
  const items: Countermeasure[] = [
    cm({
      id: 'eq_seismic_retrofit',
      applicability: {
        ownership: ['owned'],
        building_type: ['any'],
        max_year_built: 1981,
        has_member: ['any'],
        location_type: ['any'],
      },
    }),
    cm({
      id: 'cm_medication_storage',
      applicability: {
        ownership: ['owned', 'rented'],
        building_type: ['any'],
        has_member: ['elderly', 'care_needed'],
        location_type: ['any'],
      },
    }),
    cm({
      id: 'ts_arrival_time',
      applicability: {
        ownership: ['owned', 'rented'],
        building_type: ['any'],
        has_member: ['any'],
        location_type: ['coastal'],
      },
    }),
  ];

  it('passes all items when profile is empty', () => {
    expect(
      filterByProfile(items, {})
        .map((i) => i.id)
        .sort(),
    ).toEqual(items.map((i) => i.id).sort());
  });

  it('rejects retrofit when ownership is rented', () => {
    const profile: ProfileForFilter = { building: { ownership: 'rented' } };
    const out = filterByProfile(items, profile);
    expect(out.map((i) => i.id)).not.toContain('eq_seismic_retrofit');
  });

  it('rejects retrofit when year_built > 1981', () => {
    const profile: ProfileForFilter = { building: { year_built: 2010, ownership: 'owned' } };
    const out = filterByProfile(items, profile);
    expect(out.map((i) => i.id)).not.toContain('eq_seismic_retrofit');
  });

  it('passes retrofit when year_built ≤ 1981 and ownership is owned', () => {
    const profile: ProfileForFilter = { building: { year_built: 1975, ownership: 'owned' } };
    const out = filterByProfile(items, profile);
    expect(out.map((i) => i.id)).toContain('eq_seismic_retrofit');
  });

  it('elderly-only items pass when household includes elderly', () => {
    const profile: ProfileForFilter = { household: { composition: ['elderly'] } };
    const out = filterByProfile(items, profile);
    expect(out.map((i) => i.id)).toContain('cm_medication_storage');
  });

  it('elderly-only items rejected when household does not include them', () => {
    const profile: ProfileForFilter = { household: { composition: ['adults'] } };
    const out = filterByProfile(items, profile);
    expect(out.map((i) => i.id)).not.toContain('cm_medication_storage');
  });

  it('coastal items rejected when location_types are inland-only', () => {
    const profile: ProfileForFilter = { location_types: ['inland'] };
    const out = filterByProfile(items, profile);
    expect(out.map((i) => i.id)).not.toContain('ts_arrival_time');
  });

  it('coastal items pass when location_types include coastal', () => {
    const profile: ProfileForFilter = { location_types: ['coastal', 'urban'] };
    const out = filterByProfile(items, profile);
    expect(out.map((i) => i.id)).toContain('ts_arrival_time');
  });

  it('coastal items pass when location_types is empty (permissive)', () => {
    const profile: ProfileForFilter = { location_types: [] };
    const out = filterByProfile(items, profile);
    // No opt-in → no constraint applied → coastal items are visible.
    expect(out.map((i) => i.id)).toContain('ts_arrival_time');
  });
});
