import { describe, it, expect } from 'vitest';
import { parentCityCodeOfWard } from './seirei';

describe('parentCityCodeOfWard', () => {
  it('政令市の区コードを親市コードに正規化する', () => {
    expect(parentCityCodeOfWard('43104')).toBe('43100'); // 熊本市南区 → 熊本市
    expect(parentCityCodeOfWard('14101')).toBe('14100'); // 横浜市鶴見区 → 横浜市
    expect(parentCityCodeOfWard('14131')).toBe('14130'); // 川崎市川崎区 → 川崎市
    expect(parentCityCodeOfWard('27141')).toBe('27140'); // 堺市堺区 → 堺市
    expect(parentCityCodeOfWard('40132')).toBe('40130'); // 福岡市博多区 → 福岡市
    expect(parentCityCodeOfWard('01101')).toBe('01100'); // 札幌市中央区 → 札幌市
  });

  it('東京 23 区は単独自治体扱いなので親市にフォールバックしない', () => {
    expect(parentCityCodeOfWard('13101')).toBeNull(); // 千代田区
    expect(parentCityCodeOfWard('13104')).toBeNull(); // 新宿区
    expect(parentCityCodeOfWard('13123')).toBeNull(); // 江戸川区
  });

  it('独立市は親市にフォールバックしない', () => {
    expect(parentCityCodeOfWard('43202')).toBeNull(); // 八代市
    expect(parentCityCodeOfWard('14206')).toBeNull(); // 小田原市
    expect(parentCityCodeOfWard('22203')).toBeNull(); // 沼津市
  });

  it('未知のコード / 空入力は null', () => {
    expect(parentCityCodeOfWard('99999')).toBeNull();
    expect(parentCityCodeOfWard('')).toBeNull();
    expect(parentCityCodeOfWard(null)).toBeNull();
    expect(parentCityCodeOfWard(undefined)).toBeNull();
  });
});
