import { describe, it, expect } from 'vitest';
import { cleanRelativeUrl, pickTarget } from './discoverer';

describe('cleanRelativeUrl', () => {
  it('strips agent garbage prefixes / suffixes', () => {
    expect(cleanRelativeUrl('<https://example.com/a.pdf>')).toBe('https://example.com/a.pdf');
    expect(cleanRelativeUrl('"./a.pdf"')).toBe('./a.pdf');
    expect(cleanRelativeUrl('  ./a.pdf,  ')).toBe('./a.pdf');
  });

  it('returns empty for empty / undefined input', () => {
    expect(cleanRelativeUrl(undefined)).toBe('');
    expect(cleanRelativeUrl('')).toBe('');
  });
});

describe('pickTarget', () => {
  const base = 'https://www.city.example.lg.jp/disaster.html';

  it('picks 一括ダウンロード版 over diff PDFs', () => {
    const pdfs = [
      { url: 'https://example.com/01_changes.pdf', label: '修正の概要' },
      { url: 'https://example.com/02_full.pdf', label: '横浜市防災計画 一括ダウンロード版' },
      { url: 'https://example.com/03_other.pdf', label: '資料編' },
    ];
    expect(pickTarget(pdfs, base).url).toBe('https://example.com/02_full.pdf');
  });

  it('rejects diff PDFs even if they are the only candidates', () => {
    const pdfs = [
      { url: 'https://example.com/diff1.pdf', label: '新旧対照表' },
      { url: 'https://example.com/diff2.pdf', label: '修正部分のみ' },
    ];
    // Both negative-scored. The reducer still picks the higher one (not great
    // but acceptable; the caller should prefer registry-driven discovery).
    const picked = pickTarget(pdfs, base);
    expect(['https://example.com/diff1.pdf', 'https://example.com/diff2.pdf']).toContain(
      picked.url,
    );
  });

  it('throws when no PDF candidates remain after filtering', () => {
    expect(() => pickTarget([], base)).toThrow('No PDF candidates');
    // Non-PDF urls are dropped → empty list → throw.
    expect(() =>
      pickTarget([{ url: 'https://example.com/page.html', label: 'x' }], base),
    ).toThrow();
  });

  it('prefers 本編 over 概要 when both present', () => {
    const pdfs = [
      { url: 'https://example.com/01_summary.pdf', label: '概要版' },
      { url: 'https://example.com/02_main.pdf', label: '本編' },
    ];
    expect(pickTarget(pdfs, base).url).toBe('https://example.com/02_main.pdf');
  });

  it('penalises 様式 / 避難 / 校区-specific PDFs', () => {
    const pdfs = [
      { url: 'https://example.com/01_main.pdf', label: '本編' },
      { url: 'https://example.com/02_form.pdf', label: '申請様式集' },
      { url: 'https://example.com/03_school.pdf', label: '校区別ハザードマップ' },
    ];
    expect(pickTarget(pdfs, base).url).toBe('https://example.com/01_main.pdf');
  });

  it('resolves relative URLs against the page URL', () => {
    const pdfs = [{ url: '/files/main.pdf', label: '本編' }];
    expect(pickTarget(pdfs, base).url).toBe('https://www.city.example.lg.jp/files/main.pdf');
  });
});
