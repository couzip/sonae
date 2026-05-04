import { describe, it, expect } from 'vitest';
import { noopEmit, withPhase, type ProgressEvent } from './events';

describe('noopEmit', () => {
  it('accepts events without throwing', () => {
    expect(() =>
      noopEmit({ type: 'phase', phase: 'x', status: 'started', message: 'm' }),
    ).not.toThrow();
    expect(() => noopEmit({ type: 'log', message: 'hi' })).not.toThrow();
    expect(() => noopEmit({ type: 'result', data: { a: 1 } })).not.toThrow();
  });

  it('returns void (does not return anything)', () => {
    expect(noopEmit({ type: 'log', message: 'x' })).toBeUndefined();
  });
});

describe('withPhase', () => {
  it('tags phase/log/error events with the given phase', () => {
    const captured: ProgressEvent[] = [];
    const wrapped = withPhase((e) => captured.push(e), 'discovery');
    wrapped({ type: 'phase', phase: 'ignored', status: 'started', message: 'a' });
    wrapped({ type: 'log', message: 'b' });
    wrapped({ type: 'error', message: 'c' });

    expect(captured).toHaveLength(3);
    expect((captured[0] as any).phase).toBe('discovery');
    expect((captured[1] as any).phase).toBe('discovery');
    expect((captured[2] as any).phase).toBe('discovery');
  });

  it('passes through cache_hit and result unchanged', () => {
    const captured: ProgressEvent[] = [];
    const wrapped = withPhase((e) => captured.push(e), 'discovery');
    wrapped({ type: 'cache_hit', layer: 'result' });
    wrapped({ type: 'result', data: 42 });

    expect(captured).toHaveLength(2);
    expect(captured[0].type).toBe('cache_hit');
    expect((captured[0] as any).layer).toBe('result');
    expect(captured[1].type).toBe('result');
    expect((captured[1] as any).data).toBe(42);
  });

  it('overwrites an existing phase tag', () => {
    const captured: ProgressEvent[] = [];
    const wrapped = withPhase((e) => captured.push(e), 'overrider');
    wrapped({ type: 'log', message: 'x', phase: 'original' });
    expect((captured[0] as any).phase).toBe('overrider');
  });
});
