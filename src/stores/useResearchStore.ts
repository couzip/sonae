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
// 実パイプラインのフェーズ順を踏襲しつつ、各 phase ごとに時間と表示文言を分けて
// 「順に処理が進んでいる」印象にする。
interface CacheReplayStep {
  phase: Phase;
  durationMs: number;
  startedMessage: string;
  doneMessage: string;
}

const CACHE_REPLAY_STEPS: CacheReplayStep[] = [
  {
    phase: 'lookup',
    durationMs: 350,
    startedMessage: '自治体を特定しています',
    doneMessage: '特定完了',
  },
  {
    phase: 'cache_check',
    durationMs: 450,
    startedMessage: '保存済みキャッシュを確認しています',
    doneMessage: 'キャッシュ確認',
  },
  {
    phase: 'discovery',
    durationMs: 700,
    startedMessage: '計画 PDF を呼び出しています',
    doneMessage: 'PDF 確定',
  },
  {
    phase: 'retrieval',
    durationMs: 600,
    startedMessage: 'PDF を読み込んでいます',
    doneMessage: '読み込み完了',
  },
  {
    phase: 'toc',
    durationMs: 800,
    startedMessage: '目次を解析しています',
    doneMessage: '対象章 確定',
  },
  {
    phase: 'ocr_section',
    durationMs: 1100,
    startedMessage: '被害想定の本文を読み出しています',
    doneMessage: '本文取得',
  },
  {
    phase: 'extract',
    durationMs: 900,
    startedMessage: '災害種別とシナリオを再構成しています',
    doneMessage: '再構成完了',
  },
];

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
    if (i >= CACHE_REPLAY_STEPS.length) {
      const ph = get().phases;
      const last = CACHE_REPLAY_STEPS[CACHE_REPLAY_STEPS.length - 1]!;
      set({
        phases: {
          ...ph,
          [last.phase]: { phase: last.phase, status: 'done', message: last.doneMessage },
        },
        currentPhase: null,
      });
      onDone();
      return;
    }
    const ph = get().phases;
    const next = { ...ph };
    if (i > 0) {
      const prev = CACHE_REPLAY_STEPS[i - 1]!;
      next[prev.phase] = { phase: prev.phase, status: 'done', message: prev.doneMessage };
    }
    const cur = CACHE_REPLAY_STEPS[i]!;
    next[cur.phase] = { phase: cur.phase, status: 'started', message: cur.startedMessage };
    set({ phases: next, currentPhase: cur.phase });
    i++;
    setTimeout(tick, cur.durationMs);
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
          // status は触らない。result layer hit でも、replay アニメーション完走後に
          // 'result' ハンドラ側で 'done' に遷移する (replay 中は 'running' のまま)。
          append({
            ts: Date.now(),
            message: `[Cache] ${payload.layer ?? ''} ヒット`,
            tone: 'info',
          });
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
