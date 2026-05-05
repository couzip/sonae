'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Loader2, Play, RotateCcw, StopCircle } from 'lucide-react';
import type { ProgressEvent } from '@/lib/core';

interface Props {
  code: string;
}

interface LogLine {
  ts: number;
  message: string;
  tone: 'info' | 'error';
}

export function AdminResearchButton({ code }: Props) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const logTailRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    return () => {
      esRef.current?.close();
      esRef.current = null;
    };
  }, []);

  useEffect(() => {
    logTailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [logs]);

  const start = (force: boolean) => {
    if (running) return;
    setRunning(true);
    setLogs([
      {
        ts: Date.now(),
        message: force ? '解析開始 (キャッシュ全削除して再生成)' : '解析開始',
        tone: 'info',
      },
    ]);
    setError(null);
    setDone(false);

    const params = new URLSearchParams({ code });
    if (force) params.set('force', '1');
    const es = new EventSource(`/api/admin/disasters?${params.toString()}`);
    esRef.current = es;

    const append = (line: LogLine) =>
      setLogs((cur) => (cur.length > 500 ? [...cur.slice(-500), line] : [...cur, line]));

    const handle = (e: MessageEvent) => {
      let payload: ProgressEvent;
      try {
        payload = JSON.parse(e.data);
      } catch {
        return;
      }
      switch (payload.type) {
        case 'phase':
          append({
            ts: Date.now(),
            message: `[${payload.phase}] ${payload.message}`,
            tone: 'info',
          });
          break;
        case 'log':
          append({ ts: Date.now(), message: payload.message, tone: 'info' });
          break;
        case 'cache_hit':
          append({ ts: Date.now(), message: 'キャッシュヒット', tone: 'info' });
          break;
        case 'error':
          append({ ts: Date.now(), message: payload.message, tone: 'error' });
          setError(payload.message);
          break;
        case 'result':
          append({ ts: Date.now(), message: '完了', tone: 'info' });
          setDone(true);
          es.close();
          esRef.current = null;
          setRunning(false);
          router.refresh();
          break;
      }
    };

    es.addEventListener('phase', handle);
    es.addEventListener('log', handle);
    es.addEventListener('error', handle as any);
    es.addEventListener('cache_hit', handle);
    es.addEventListener('result', handle);

    es.onerror = () => {
      const stillRunning = !done && !error;
      es.close();
      esRef.current = null;
      if (stillRunning) {
        append({ ts: Date.now(), message: 'SSE 接続が切断されました', tone: 'error' });
        setError('SSE 切断');
      }
      setRunning(false);
    };
  };

  const cancel = () => {
    esRef.current?.close();
    esRef.current = null;
    setRunning(false);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => start(false)}
          disabled={running}
          className="inline-flex items-center gap-1.5 border-hairline border-accent bg-accent-soft hover:bg-accent-dim disabled:opacity-50 px-3 py-1.5 rounded-cockpit text-sm text-accent transition-colors"
        >
          {running ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Play className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          )}
          キャッシュ生成
        </button>
        <button
          type="button"
          onClick={() => start(true)}
          disabled={running}
          className="inline-flex items-center gap-1.5 border-hairline border-hairline hover:border-accent disabled:opacity-50 px-3 py-1.5 rounded-cockpit text-sm text-ink-mute hover:text-ink transition-colors"
        >
          <RotateCcw className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          全部消して再生成
        </button>
        {running && (
          <button
            type="button"
            onClick={cancel}
            className="inline-flex items-center gap-1.5 border-hairline border-scale-lg/70 bg-scale-lg/10 hover:bg-scale-lg/20 px-3 py-1.5 rounded-cockpit text-sm text-scale-lg transition-colors"
          >
            <StopCircle className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            中断
          </button>
        )}
      </div>

      {error && !running && (
        <div className="inline-flex items-start gap-2 border-hairline border-scale-lg bg-scale-lg/10 p-3 rounded-cockpit text-xs text-scale-lg">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden />
          <span>{error}</span>
        </div>
      )}

      {logs.length > 0 && (
        <div className="border-hairline border-hairline rounded-cockpit p-3 bg-bg-sunken/40 max-h-72 overflow-auto">
          <ul className="text-xs font-mono flex flex-col gap-0.5">
            {logs.map((l, i) => (
              <li key={i} className={l.tone === 'error' ? 'text-scale-lg' : 'text-ink-mute'}>
                <span className="text-ink-dim mr-2 tabular-nums">
                  {new Date(l.ts).toLocaleTimeString('ja-JP', { hour12: false })}
                </span>
                {l.message}
              </li>
            ))}
          </ul>
          <div ref={logTailRef} />
        </div>
      )}
    </div>
  );
}
