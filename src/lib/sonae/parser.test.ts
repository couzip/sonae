import { describe, it, expect } from 'vitest';
import { coreTitle, findTitleHeading } from './parser';

describe('coreTitle', () => {
  it('「第N節」「第N章」「第N編」「第N部」を剥がす', () => {
    expect(coreTitle('第3節 災害想定')).toBe('災害想定');
    expect(coreTitle('第２章 被害想定')).toBe('被害想定');
    expect(coreTitle('第1編 総則')).toBe('総則');
    expect(coreTitle('第４部 復旧計画')).toBe('復旧計画');
  });

  it('「第N」 (章/節 等の接尾辞無し) も剥がす', () => {
    expect(coreTitle('第15 予想される地震災害')).toBe('予想される地震災害');
  });

  it('全角・漢数字も処理できる', () => {
    expect(coreTitle('第１章 ABC')).toBe('ABC');
    expect(coreTitle('第三節 ABC')).toBe('ABC');
  });

  it('番号 (1. / 2．/ ２) のみの接頭辞も剥がす', () => {
    expect(coreTitle('1. ABC')).toBe('ABC');
    expect(coreTitle('２．ABC')).toBe('ABC');
    expect(coreTitle('3) ABC')).toBe('ABC');
  });

  it('接頭辞が無い場合はそのまま返す', () => {
    expect(coreTitle('被害想定')).toBe('被害想定');
  });
});

const norm = (s: string) =>
  s
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xff10 + 0x30))
    .replace(/[\s　・,。、()（）]/g, '');

describe('findTitleHeading', () => {
  const target = norm('第3節 徳島県南海トラフ巨大地震被害想定（令和8年2月4日公表）');
  const core = norm('徳島県南海トラフ巨大地震被害想定（令和8年2月4日公表）');

  it('Markdown heading (#〜####) で完全一致', () => {
    const text = `### 第3節 徳島県南海トラフ巨大地震被害想定（令和8年2月4日公表）\nbody`;
    expect(findTitleHeading(text, [target, core])).toBe(
      '第3節 徳島県南海トラフ巨大地震被害想定（令和8年2月4日公表）',
    );
  });

  it('# heading で coreTitle (節番号違い) で部分一致', () => {
    const text = `### 第2節 徳島県南海トラフ巨大地震被害想定（令和8年2月4日公表）\nbody`;
    expect(findTitleHeading(text, [target, core])).toBe(
      '第2節 徳島県南海トラフ巨大地震被害想定（令和8年2月4日公表）',
    );
  });

  it('bold (**...**) heading でも検出 (markdown 化されない OCR 出力)', () => {
    const text = `**第3節 徳島県南海トラフ巨大地震被害想定（令和8年2月4日公表）**\n本文`;
    expect(findTitleHeading(text, [target, core])).toBe(
      '第3節 徳島県南海トラフ巨大地震被害想定（令和8年2月4日公表）',
    );
  });

  it('裸テキスト heading でもページ冒頭 20 行内なら検出', () => {
    const text = `第3節 徳島県南海トラフ巨大地震被害想定（令和8年2月4日公表）\n本文`;
    expect(findTitleHeading(text, [target, core])).toBe(
      '第3節 徳島県南海トラフ巨大地震被害想定（令和8年2月4日公表）',
    );
  });

  it('20 行を超える位置のテキストはマッチさせない (本文混入防止)', () => {
    const padding = Array(25).fill('').join('\n');
    const text = `${padding}\n第3節 徳島県南海トラフ巨大地震被害想定（令和8年2月4日公表）`;
    expect(findTitleHeading(text, [target, core])).toBeNull();
  });

  it('短すぎる候補 (< 6 文字) は除外する', () => {
    const text = `**短い**\n本文`;
    expect(findTitleHeading(text, [norm('短')])).toBeNull();
  });

  it('keywords が無ければ null', () => {
    const text = `### 第3節 ABC\n本文`;
    expect(findTitleHeading(text, [])).toBeNull();
    expect(findTitleHeading(text, [''])).toBeNull();
  });

  it('全角数字を半角に正規化して比較できる', () => {
    const text = `### 第３節 ABC\n本文`;
    const k = norm('第3節 ABC');
    expect(findTitleHeading(text, [k])).toBe('第３節 ABC');
  });
});
