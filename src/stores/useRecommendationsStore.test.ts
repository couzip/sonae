import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextActions, NextActionsInput } from '@/lib/sonae';
import { useRecommendationsStore } from './useRecommendationsStore';

const emptyChecklist: NextActionsInput['checklist_state'] = {
  completed: [],
  pending: [],
  not_applicable: [],
  unanswered: [],
};

function actions(marker: string): NextActions & { marker: string } {
  return {
    marker,
    strategic_insights: [],
    priority_actions: [],
    encouragement: '',
    long_term_considerations: [],
  };
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('useRecommendationsStore', () => {
  beforeEach(() => {
    useRecommendationsStore.getState().reset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('新しい生成を始める時に自治体コードを保持し、古い結果を消す', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(actions('new')));
    vi.stubGlobal('fetch', fetchMock);

    useRecommendationsStore.setState({
      code: 'old',
      status: 'done',
      result: actions('old'),
      error: null,
    });

    const p = useRecommendationsStore.getState().generate('14100', '横浜市', {}, emptyChecklist);

    expect(useRecommendationsStore.getState()).toMatchObject({
      code: '14100',
      status: 'loading',
      result: null,
      error: null,
    });

    await p;

    const state = useRecommendationsStore.getState();
    expect(state.status).toBe('done');
    expect(state.code).toBe('14100');
    expect((state.result as NextActions & { marker: string }).marker).toBe('new');
  });

  it('古いリクエストが後から解決しても最新の結果を上書きしない', async () => {
    let resolveOld!: (value: Response) => void;
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            resolveOld = resolve;
          }),
      )
      .mockImplementationOnce(async () => jsonResponse(actions('new')));
    vi.stubGlobal('fetch', fetchMock);

    const oldRequest = useRecommendationsStore
      .getState()
      .generate('13100', '東京23区', {}, emptyChecklist);
    const newRequest = useRecommendationsStore
      .getState()
      .generate('14100', '横浜市', {}, emptyChecklist);

    await newRequest;
    resolveOld(jsonResponse(actions('old')));
    await oldRequest;

    const state = useRecommendationsStore.getState();
    expect(state.code).toBe('14100');
    expect(state.status).toBe('done');
    expect((state.result as NextActions & { marker: string }).marker).toBe('new');
  });
});
