import { describe, it, expect } from 'vitest';
import { summarizeProfile } from './nextActions';

describe('summarizeProfile', () => {
  it('全フィールド埋まっているプロファイル', () => {
    const r = summarizeProfile({
      building: {
        year_built: 1985,
        construction: '木造',
        ownership: 'owned',
        total_floors: 2,
        living_floor: 1,
      },
      household: { composition: ['乳幼児', '高齢者'] },
    });
    expect(r).toContain('築41年(1985年)');
    expect(r).toContain('木造');
    expect(r).toContain('所有');
    expect(r).toContain('2階建');
    expect(r).toContain('1階居住');
    expect(r).toContain('同居: 乳幼児/高齢者');
  });

  it('賃貸の表記', () => {
    const r = summarizeProfile({
      building: { year_built: 2010, ownership: 'rented' },
    });
    expect(r).toContain('賃貸');
    expect(r).not.toContain('所有');
  });

  it('プロファイル全空なら "未入力"', () => {
    expect(summarizeProfile({})).toBe('未入力');
  });

  it('部分入力: building の year_built だけ', () => {
    const r = summarizeProfile({ building: { year_built: 2000 } });
    expect(r).toBe('築26年(2000年)');
  });

  it('household.composition が空配列なら省略', () => {
    const r = summarizeProfile({
      building: { construction: 'rc' },
      household: { composition: [] },
    });
    expect(r).toBe('rc');
  });
});
