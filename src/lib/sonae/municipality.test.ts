import { describe, it, expect } from 'vitest';
import { findByCode, findByName, findNearestByCoords, listRegistry } from './municipality';

describe('municipality registry', () => {
  it('findByCode で seed の主要自治体を引ける', () => {
    expect(findByCode('14100')?.name).toBe('横浜市');
    expect(findByCode('43100')?.name).toBe('熊本市');
    expect(findByCode('13101')?.name).toBe('千代田区');
  });

  it('findByCode で未知のコードは null', () => {
    expect(findByCode('99999')).toBeNull();
    expect(findByCode('')).toBeNull();
  });

  it('findByName で完全一致', () => {
    expect(findByName('横浜市')?.code).toBe('14100');
    expect(findByName('千代田区')?.code).toBe('13101');
  });

  it('findByName で alias マッチ', () => {
    expect(findByName('よこはま市')?.code).toBe('14100');
    expect(findByName('くまもと市')?.code).toBe('43100');
  });

  it('findByName で includes (住所文字列) マッチ', () => {
    expect(findByName('神奈川県横浜市西区')?.code).toBe('14100');
    expect(findByName('熊本県熊本市南区')?.code).toBe('43100');
  });

  it('findByName で空入力は null', () => {
    expect(findByName('')).toBeNull();
    expect(findByName('   ')).toBeNull();
  });

  it('findNearestByCoords で最寄りを返す', () => {
    // 横浜市 (14100) lat=35.4437 lng=139.6380 付近
    const m = findNearestByCoords(35.45, 139.64);
    expect(m?.code).toBe('14100');
  });

  it('listRegistry が seed を含む配列を返す', () => {
    const all = listRegistry();
    expect(all.length).toBeGreaterThan(10);
    expect(all.some((m) => m.code === '14100')).toBe(true);
  });
});
