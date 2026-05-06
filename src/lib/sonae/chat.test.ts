/**
 * Unit tests for the chat RAG helpers.
 *
 * `buildChatTools` itself is exercised end-to-end by the `/api/ask` route
 * tests; here we cover the pure functions that drive retrieval (chunking,
 * bigram scoring) so regressions on Japanese / heading edge cases surface
 * immediately.
 */

import { describe, expect, it } from 'vitest';
import { bigramOverlap, chunkPlanMarkdown } from './chat';

describe('chunkPlanMarkdown', () => {
  it('splits on heading lines and preserves body', () => {
    const md = `# 第1部 総則\n概要\n## 1-1 想定災害\n地震と津波\n## 1-2 被害想定\n建物倒壊\n`;
    const chunks = chunkPlanMarkdown(md);
    expect(chunks.map((c) => c.heading)).toEqual(['第1部 総則', '1-1 想定災害', '1-2 被害想定']);
    expect(chunks[1]?.body.trim()).toBe('地震と津波');
  });

  it('captures page markers like "p.42"', () => {
    const md = `## 章A\np.10\n本文 A\n## 章B\np.42\n本文 B\n`;
    const chunks = chunkPlanMarkdown(md);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]?.page).toBe(10);
    expect(chunks[1]?.page).toBe(42);
  });

  it('emits a synthetic "(冒頭)" chunk for content before the first heading', () => {
    const md = `前文です\n## 章A\n本文\n`;
    const chunks = chunkPlanMarkdown(md);
    expect(chunks[0]?.heading).toBe('(冒頭)');
    expect(chunks[0]?.body.trim()).toBe('前文です');
  });

  it('skips empty body chunks', () => {
    const md = `## 章A\n\n## 章B\n本文\n`;
    const chunks = chunkPlanMarkdown(md);
    expect(chunks.map((c) => c.heading)).toEqual(['章B']);
  });
});

describe('bigramOverlap', () => {
  it('returns 1.0 when query is fully contained', () => {
    expect(bigramOverlap('地震', '今日は地震の話をします')).toBe(1);
  });

  it('returns 0 when no shared bigrams', () => {
    expect(bigramOverlap('地震', '快晴で気温は穏やか')).toBe(0);
  });

  it('returns a fraction for partial overlap', () => {
    const score = bigramOverlap('地震 津波', '地震の影響と建物倒壊');
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(1);
  });

  it('returns 0 for empty query', () => {
    expect(bigramOverlap('', 'なんでもいい')).toBe(0);
  });

  it('is case-insensitive for ASCII', () => {
    expect(bigramOverlap('Earthquake', 'EARTHQUAKE in Tokyo')).toBe(1);
  });
});
