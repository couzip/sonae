import { describe, it, expect } from 'vitest';
import { disasterTone } from './disaster-style';

describe('disasterTone', () => {
  it('登録済の災害種別は専用 tone を返す', () => {
    const t = disasterTone('地震');
    expect(t.border).toMatch(/rgba/);
    expect(t.fill).toMatch(/rgba/);
    expect(t.text).toMatch(/rgba/);
  });

  it('種別ごとに tone は異なる', () => {
    expect(disasterTone('地震').border).not.toBe(disasterTone('津波').border);
    expect(disasterTone('津波').border).not.toBe(disasterTone('火山噴火').border);
  });

  it('未登録の種別は fallback (灰色) を返す', () => {
    const t = disasterTone('未知の災害');
    expect(t.border).toBe('rgba(82, 82, 91, 0.65)');
  });
});
