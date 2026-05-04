import { describe, it, expect } from 'vitest';
import { disasterJpToEnum } from './disaster-mapping';

describe('disasterJpToEnum', () => {
  it('maps known Japanese disaster names to enum values', () => {
    expect(disasterJpToEnum('地震')).toBe('earthquake');
    expect(disasterJpToEnum('津波')).toBe('tsunami');
    expect(disasterJpToEnum('土砂災害')).toBe('landslide');
    expect(disasterJpToEnum('火山噴火')).toBe('volcanic');
  });

  it('coalesces 風水害 and 洪水 to flood', () => {
    expect(disasterJpToEnum('風水害')).toBe('flood');
    expect(disasterJpToEnum('洪水')).toBe('flood');
  });

  it('coalesces 鉄道災害 / 道路災害 / 航空災害 to transport', () => {
    expect(disasterJpToEnum('鉄道災害')).toBe('transport');
    expect(disasterJpToEnum('道路災害')).toBe('transport');
    expect(disasterJpToEnum('航空災害')).toBe('transport');
  });

  it('falls back to lowercase for unknown values', () => {
    expect(disasterJpToEnum('UnknownThing')).toBe('unknownthing');
  });
});
