import { describe, it, expect } from 'vitest';
import { cleanRelativeUrl } from './discoverer';

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
