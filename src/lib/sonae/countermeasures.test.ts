import { describe, it, expect } from 'vitest';
import { filterByDetectedDisasters, loadCountermeasures } from './countermeasures';

describe('countermeasures master', () => {
  it('loadCountermeasures: yaml が valid に parse でき、十分な件数を持つ', () => {
    const all = loadCountermeasures();
    expect(all.length).toBeGreaterThan(50);
    expect(all.every((c) => typeof c.id === 'string' && c.id.length > 0)).toBe(true);
    expect(all.every((c) => Array.isArray(c.applicable_disasters))).toBe(true);
  });

  it('filterByDetectedDisasters: 検出種別 0 件でも disaster_group=common は返る', () => {
    const all = loadCountermeasures();
    const filtered = filterByDetectedDisasters(all, []);
    expect(filtered.every((c) => c.disaster_group === 'common')).toBe(true);
  });

  it('filterByDetectedDisasters: 「地震」だけ検出した場合、地震適用対策のみ残る', () => {
    const all = loadCountermeasures();
    const filtered = filterByDetectedDisasters(all, ['地震']);
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.length).toBeLessThan(all.length);
    expect(filtered.every((c) => c.applicable_disasters.includes('earthquake'))).toBe(true);
  });

  it('filterByDetectedDisasters: 「地震」「津波」検出は両方の対策の和集合', () => {
    const all = loadCountermeasures();
    const eq = filterByDetectedDisasters(all, ['地震']);
    const eqTs = filterByDetectedDisasters(all, ['地震', '津波']);
    expect(eqTs.length).toBeGreaterThanOrEqual(eq.length);
  });
});
