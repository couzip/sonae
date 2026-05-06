import { describe, it, expect } from 'vitest';
import { PREFECTURE_BY_CODE, prefectureCodeOf, prefectureNameOf } from './prefectures';

describe('prefectures map', () => {
  it('47 都道府県すべて登録されている', () => {
    expect(Object.keys(PREFECTURE_BY_CODE)).toHaveLength(47);
  });

  it('代表的な都道府県コード→名前', () => {
    expect(PREFECTURE_BY_CODE['01']).toBe('北海道');
    expect(PREFECTURE_BY_CODE['13']).toBe('東京都');
    expect(PREFECTURE_BY_CODE['14']).toBe('神奈川県');
    expect(PREFECTURE_BY_CODE['27']).toBe('大阪府');
    expect(PREFECTURE_BY_CODE['43']).toBe('熊本県');
    expect(PREFECTURE_BY_CODE['47']).toBe('沖縄県');
  });

  it('prefectureCodeOf は 5 桁市町村コードの先頭 2 桁を返す', () => {
    expect(prefectureCodeOf('14100')).toBe('14');
    expect(prefectureCodeOf('43104')).toBe('43');
    expect(prefectureCodeOf('01101')).toBe('01');
  });

  it('prefectureNameOf は市町村コードから都道府県名を引く', () => {
    expect(prefectureNameOf('14100')).toBe('神奈川県');
    expect(prefectureNameOf('43104')).toBe('熊本県');
    expect(prefectureNameOf('13101')).toBe('東京都');
  });

  it('未知のコードは空文字を返す', () => {
    expect(prefectureNameOf('99999')).toBe('');
  });
});
