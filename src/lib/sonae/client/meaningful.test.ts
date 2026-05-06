import { describe, it, expect } from 'vitest';
import { isMeaningful } from './meaningful';

describe('isMeaningful', () => {
  it('実体のある文字列は true', () => {
    expect(isMeaningful('M7.9')).toBe(true);
    expect(isMeaningful('全壊棟数 1,332棟')).toBe(true);
    expect(isMeaningful('a')).toBe(true);
  });

  it('null / undefined / 空文字 / 空白のみは false', () => {
    expect(isMeaningful(null)).toBe(false);
    expect(isMeaningful(undefined)).toBe(false);
    expect(isMeaningful('')).toBe(false);
    expect(isMeaningful('   ')).toBe(false);
  });

  it('プレースホルダ文字列は false', () => {
    expect(isMeaningful('記載なし')).toBe(false);
    expect(isMeaningful('不明')).toBe(false);
    expect(isMeaningful('—')).toBe(false);
    expect(isMeaningful('-')).toBe(false);
    expect(isMeaningful('N/A')).toBe(false);
    expect(isMeaningful('n/a')).toBe(false);
    expect(isMeaningful('NA')).toBe(false);
    expect(isMeaningful('null')).toBe(false);
    expect(isMeaningful('none')).toBe(false);
    expect(isMeaningful('undefined')).toBe(false);
    expect(isMeaningful('不詳')).toBe(false);
    expect(isMeaningful('なし')).toBe(false);
    expect(isMeaningful('無し')).toBe(false);
    expect(isMeaningful('未記載')).toBe(false);
  });

  it('前後 whitespace は trim される', () => {
    expect(isMeaningful('  記載なし  ')).toBe(false);
    expect(isMeaningful('  実値  ')).toBe(true);
  });

  it('プレースホルダを部分文字列として含むだけなら true', () => {
    expect(isMeaningful('記載なし (注釈付き)')).toBe(true); // 完全一致でないので true
    expect(isMeaningful('不明な点')).toBe(true);
  });
});
