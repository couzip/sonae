/**
 * Pipeline progress event surface.
 *
 * Domain-agnostic event types for streaming pipeline progress to clients.
 * The `phase` field is a free-form string so each domain can name its own phases.
 */

export type PhaseStatus = 'started' | 'progress' | 'done';

export type ProgressEvent =
  | { type: 'phase'; phase: string; status: PhaseStatus; message: string; data?: unknown }
  | { type: 'log'; message: string; phase?: string }
  | { type: 'error'; message: string; phase?: string }
  | { type: 'cache_hit'; layer: string; data?: unknown }
  | { type: 'result'; data: unknown };

export type EmitFn = (event: ProgressEvent) => void;

/** No-op emitter for tests / batch invocations. */
export const noopEmit: EmitFn = () => {};

/** Wrap an emit so every emitted event includes a phase tag. */
export function withPhase(emit: EmitFn, phase: string): EmitFn {
  return (event) => {
    if (event.type === 'phase' || event.type === 'log' || event.type === 'error') {
      emit({ ...event, phase });
      return;
    }
    emit(event);
  };
}
