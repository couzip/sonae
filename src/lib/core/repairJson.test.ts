import { describe, it, expect } from 'vitest';
import { repairTruncatedJson } from './repairJson';

describe('repairTruncatedJson', () => {
  it('passes through valid JSON', () => {
    expect(repairTruncatedJson('{"a":1}')).toEqual({ a: 1 });
    expect(repairTruncatedJson('[1,2,3]')).toEqual([1, 2, 3]);
  });

  it('returns null for empty input', () => {
    expect(repairTruncatedJson('')).toBeNull();
  });

  it('closes a truncated array', () => {
    expect(repairTruncatedJson('{"items":[1,2,3')).toEqual({ items: [1, 2, 3] });
  });

  it('closes a truncated object inside an array', () => {
    const result = repairTruncatedJson('{"xs":[{"a":1},{"a":2');
    expect(result).toEqual({ xs: [{ a: 1 }, { a: 2 }] });
  });

  it('drops a trailing comma before closing', () => {
    expect(repairTruncatedJson('{"a":1,')).toEqual({ a: 1 });
  });

  it('trims a half-open string before closing', () => {
    // String "fooba is half-open; the algorithm cuts after the last opening
    // quote and re-closes braces.
    const out = repairTruncatedJson('{"a":"complete","b":"truncated');
    expect(out).toEqual({ a: 'complete', b: 'truncated' });
  });

  it('returns null when even the repair fails to parse', () => {
    // Garbage with no recoverable JSON shape.
    expect(repairTruncatedJson('not json at all 12345 :: {{{')).toBeNull();
  });

  it('handles nested structures', () => {
    const out = repairTruncatedJson('{"a":{"b":{"c":[1,2');
    expect(out).toEqual({ a: { b: { c: [1, 2] } } });
  });

  it('does not double-close when input is already valid', () => {
    const valid = '{"a":[1,2],"b":{"c":3}}';
    expect(repairTruncatedJson(valid)).toEqual({ a: [1, 2], b: { c: 3 } });
  });
});
