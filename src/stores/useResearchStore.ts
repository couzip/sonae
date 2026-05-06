'use client';

import { create } from 'zustand';
import type { ProgressEvent } from '@/lib/core';
import type { DisasterAssessment, SonaePhase } from '@/lib/sonae';

// Pipeline emits a generic `string` phase; the Sonae UI renders it as one of
// the known `SonaePhase` values (or just shows the raw string for unknown
// phases the framework happens to emit).
type Phase = SonaePhase | string;

export type ResearchStatus = 'idle' | 'running' | 'done' | 'error' | 'cache_hit';

export interface PhaseStatus {
  phase: Phase;
  status: 'pending' | 'started' | 'progress' | 'done';
  message: string;
}

export interface LogLine {
  ts: number;
  phase?: Phase;
  message: string;
  tone: 'info' | 'error';
}

interface ResearchState {
  code: string | null;
  status: ResearchStatus;
  currentPhase: Phase | null;
  phases: Record<Phase, PhaseStatus>;
  logs: LogLine[];
  result: DisasterAssessment | null;
  error: string | null;
  /** SSE 接続を開始 */
  start: (code: string, opts?: { force?: boolean; name?: string; prefecture?: string }) => void;
  /** 接続を切る (ユーザー離脱時) */
  abort: () => void;
  reset: () => void;
}

const ALL_PHASES: Phase[] = [
  'lookup',
  'cache_check',
  'discovery',
  'retrieval',
  'toc',
  'ocr_scan',
  'ocr_section',
  'extract',
  'done',
];

// キャッシュ即返答時、UI 上で各 step を順に再生して「ちゃんと調べた」感を出す。
const CACHE_REPLAY_PHASES: Phase[] = ['discovery', 'retrieval', 'toc', 'ocr_section', 'extract'];
const CACHE_REPLAY_STEP_MS = 400;

function initialPhases(): Record<Phase, PhaseStatus> {
  const out = {} as Record<Phase, PhaseStatus>;
  for (const p of ALL_PHASES) {
    out[p] = { phase: p, status: 'pending', message: '' };
  }
  return out;
}

type SetFn = (partial: Partial<ResearchState>) => void;
type GetFn = () => ResearchState;

function replayCacheAnimation(set: SetFn, get: GetFn, onDone: () => void): void {
  let i = 0;
  const tick = () => {
    if (i >= CACHE_REPLAY_PHASES.length) {
      const ph = get().phases;
      const last = CACHE_REPLAY_PHASES[CACHE_REPLAY_PHASES.length - 1]!;
      set({
        phases: {
          ...ph,
          [last]: { phase: last, status: 'done', message: 'キャッシュ' },
        },
        currentPhase: null,
      });
      onDone();
      return;
    }
    const ph = get().phases;
    const next = { ...ph };
    if (i > 0) {
      const prev = CACHE_REPLAY_PHASES[i - 1]!;
      next[prev] = { phase: prev, status: 'done', message: 'キャッシュ' };
    }
    const cur = CACHE_REPLAY_PHASES[i]!;
    next[cur] = { phase: cur, status: 'started', message: 'キャッシュ取得中…' };
    set({ phases: next, currentPhase: cur });
    i++;
    setTimeout(tick, CACHE_REPLAY_STEP_MS);
  };
  tick();
}

let currentSource: EventSource | null = null;

export const useResearchStore = create<ResearchState>()((set, get) => ({
  code: null,
  status: 'idle',
  currentPhase: null,
  phases: initialPhases(),
  logs: [],
  result: null,
  error: null,

  start: (code, opts) => {
    // 既存接続を閉じる
    currentSource?.close();
    currentSource = null;

    set({
      code,
      status: 'running',
      currentPhase: null,
      phases: initialPhases(),
      logs: [
        {
          ts: Date.now(),
          message: `=== リサーチ開始 (${code})${opts?.force ? ' [強制再解析]' : ''} ===`,
          tone: 'info',
        },
      ],
      result: null,
      error: null,
    });

    if (typeof window === 'undefined') return;

    const params = new URLSearchParams({ code });
    if (opts?.force) params.set('force', '1');
    if (opts?.name) params.set('name', opts.name);
    if (opts?.prefecture) params.set('prefecture', opts.prefecture);
    const url = `/api/disasters?${params.toString()}`;
    const es = new EventSource(url);
    currentSource = es;

    const append = (line: LogLine) => {
      const cur = get().logs;
      const next = [...cur, line];
      // 古いログを切り捨て
      set({ logs: next.length > 500 ? next.slice(-500) : next });
    };

    const handle = (e: MessageEvent) => {
      let payload: ProgressEvent;
      try {
        payload = JSON.parse(e.data);
      } catch {
        return;
      }
      switch (payload.type) {
        case 'phase': {
          const ph = get().phases;
          set({
            phases: {
              ...ph,
              [payload.phase]: {
                phase: payload.phase,
                status: payload.status,
                message: payload.message,
              },
            },
            currentPhase: payload.phase,
          });
          append({
            ts: Date.now(),
            phase: payload.phase,
            message: `[${payload.phase}] ${payload.message}`,
            tone: 'info',
          });
          break;
        }
        case 'log':
          append({ ts: Date.now(), phase: payload.phase, message: payload.message, tone: 'info' });
          break;
        case 'error':
          append({
            ts: Date.now(),
            phase: payload.phase,
            message: `ERROR: ${payload.message}`,
            tone: 'error',
          });
          set({ status: 'error', error: payload.message });
          break;
        case 'cache_hit':
          // 中間 layer (source/blob/parsed) の cache_hit は完了扱いにしない。
          // result layer のみが「最終結果がそのまま返る」=完了。
          append({
            ts: Date.now(),
            message: `[Cache] ${payload.layer ?? ''} ヒット`,
            tone: 'info',
          });
          if (payload.layer === 'result') set({ status: 'cache_hit' });
          break;
        case 'result': {
          const ph = get().phases;
          const nothingPlayed = ph.discovery?.status === 'pending';
          set({ result: payload.data as DisasterAssessment });
          es.close();
          currentSource = null;
          if (nothingPlayed) {
            replayCacheAnimation(set, get, () => {
              set({ status: 'done' });
              append({ ts: Date.now(), message: '=== 完了 (キャッシュ) ===', tone: 'info' });
            });
          } else {
            set({ status: 'done' });
            append({ ts: Date.now(), message: '=== 完了 ===', tone: 'info' });
          }
          break;
        }
      }
    };

    es.addEventListener('phase', handle);
    es.addEventListener('log', handle);
    es.addEventListener('error', handle as any);
    es.addEventListener('cache_hit', handle);
    es.addEventListener('result', handle);

    es.onerror = () => {
      // 正常完了時にも onerror が発火するのでステータスで判断
      const s = get().status;
      if (s === 'running') {
        append({ ts: Date.now(), message: 'SSE 接続が切断されました', tone: 'error' });
        set({ status: 'error', error: 'SSE 切断' });
      }
      es.close();
      if (currentSource === es) currentSource = null;
    };
  },

  abort: () => {
    currentSource?.close();
    currentSource = null;
    if (get().status === 'running') {
      set({ status: 'idle' });
    }
  },

  reset: () => {
    currentSource?.close();
    currentSource = null;
    set({
      code: null,
      status: 'idle',
      currentPhase: null,
      phases: initialPhases(),
      logs: [],
      result: null,
      error: null,
    });
  },
}));
