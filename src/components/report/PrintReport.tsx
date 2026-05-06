'use client';

import { forwardRef } from 'react';
import type { DisasterAssessment } from '@/lib/sonae';
import type { Countermeasure } from '@/lib/sonae/client/countermeasures-filter';
import type { NextActions } from '@/lib/sonae';
import type { ChecklistItemState } from '@/stores/useChecklistStore';
import { isMeaningful } from '@/lib/sonae/client/meaningful';

interface PrintReportProps {
  municipality: { code: string; name: string; prefecture: string };
  result: DisasterAssessment;
  nextActions: NextActions | null;
  countermeasures: Countermeasure[];
  checklistState: Record<string, ChecklistItemState>;
}

const URGENCY_LABEL: Record<'this_week' | 'this_month' | 'long_term', string> = {
  this_week: '今週',
  this_month: '今月',
  long_term: '中長期',
};

const STATE_LABEL: Record<ChecklistItemState, string> = {
  done: 'できた',
  pending: 'まだ',
  na: '不要',
  unanswered: '未回答',
};

export const PrintReport = forwardRef<HTMLDivElement, PrintReportProps>(function PrintReport(
  { municipality, result, nextActions, countermeasures, checklistState },
  ref,
) {
  const today = new Date().toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const labelOf = (id: string): string => countermeasures.find((c) => c.id === id)?.label ?? id;
  // 旧キャッシュなど LLM が user-facing テキストに action_id を漏らした場合の最終 strip
  const ID_PAREN_RE = /[（(]\s*[a-z][a-z0-9]*(?:_[a-z0-9]+)+\s*[）)]/g;
  const stripIds = (s: string): string =>
    s.replace(ID_PAREN_RE, '').replace(/\s+([、。])/g, '$1').trim();

  const activeDisasters = result.by_disaster_type.filter((d) => d.scenarios.length > 0);

  const prefix = `${municipality.code}:`;
  const grouped: Record<ChecklistItemState, Countermeasure[]> = {
    done: [],
    pending: [],
    na: [],
    unanswered: [],
  };
  for (const c of countermeasures) {
    const state = checklistState[`${prefix}${c.id}`] ?? 'unanswered';
    grouped[state].push(c);
  }

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        left: '-99999px',
        top: 0,
        width: '794px',
        padding: '32px 40px',
        background: '#ffffff',
        color: '#0f172a',
        fontFamily:
          '"Hiragino Kaku Gothic ProN", "Yu Gothic", "Meiryo", "Noto Sans JP", sans-serif',
        fontSize: '12px',
        lineHeight: 1.6,
      }}
    >
      <header style={{ borderBottom: '2px solid #0f172a', paddingBottom: 12, marginBottom: 20 }}>
        <div style={{ fontSize: '11px', color: '#64748b', letterSpacing: '0.1em' }}>
          Sonae 個別レポート
        </div>
        <h1 style={{ fontSize: '22px', fontWeight: 700, margin: '4px 0 0' }}>
          {municipality.prefecture} {municipality.name}
        </h1>
        <div style={{ fontSize: '11px', color: '#475569', marginTop: 4 }}>
          解析日 {today} / 自治体コード {municipality.code}
        </div>
      </header>

      <section style={{ marginBottom: 24 }}>
        <h2
          style={{
            fontSize: '14px',
            fontWeight: 700,
            borderBottom: '1px solid #cbd5e1',
            paddingBottom: 4,
            marginBottom: 10,
          }}
        >
          想定される災害
        </h2>
        {activeDisasters.length === 0 ? (
          <p style={{ color: '#64748b' }}>該当する想定なし</p>
        ) : (
          activeDisasters.map((d) => (
            <div key={d.disaster_type} style={{ marginBottom: 14 }}>
              <h3 style={{ fontSize: '13px', fontWeight: 700, margin: '0 0 6px' }}>
                {d.disaster_type}
                <span style={{ fontSize: '10px', color: '#64748b', marginLeft: 8 }}>
                  {d.scenarios.length} 件
                </span>
              </h3>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {d.scenarios
                  .filter(
                    (s) =>
                      isMeaningful(s.name) ||
                      isMeaningful(s.scale) ||
                      isMeaningful(s.expected_damage),
                  )
                  .map((s, i) => {
                    const name = isMeaningful(s.name) ? s.name : '想定シナリオ';
                    const scale = isMeaningful(s.scale) ? s.scale : null;
                    const damage = isMeaningful(s.expected_damage) ? s.expected_damage : null;
                    return (
                      <li
                        key={i}
                        style={{
                          padding: '6px 8px',
                          marginBottom: 4,
                          background: '#f1f5f9',
                          borderLeft: '3px solid #0f172a',
                          borderRadius: 2,
                        }}
                      >
                        <div style={{ fontWeight: 600 }}>{name}</div>
                        {scale && <div style={{ color: '#475569' }}>{scale}</div>}
                        {damage && (
                          <div style={{ color: '#475569', marginTop: 2 }}>{damage}</div>
                        )}
                      </li>
                    );
                  })}
              </ul>
            </div>
          ))
        )}
      </section>

      {nextActions?.priority_actions && nextActions.priority_actions.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <h2
            style={{
              fontSize: '14px',
              fontWeight: 700,
              borderBottom: '1px solid #cbd5e1',
              paddingBottom: 4,
              marginBottom: 10,
            }}
          >
            優先行動
          </h2>
          {nextActions.priority_actions.map((a, i) => (
            <div
              key={i}
              style={{
                padding: '8px 10px',
                marginBottom: 6,
                border: '1px solid #cbd5e1',
                borderRadius: 2,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ fontWeight: 700 }}>{labelOf(a.action_id)}</div>
                <div
                  style={{
                    fontSize: '10px',
                    background: '#0f172a',
                    color: '#fff',
                    padding: '2px 6px',
                    borderRadius: 2,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {URGENCY_LABEL[a.urgency]}
                </div>
              </div>
              <div style={{ color: '#334155', marginTop: 4 }}>{stripIds(a.reasoning)}</div>
              <div style={{ color: '#64748b', fontSize: '10px', marginTop: 4 }}>
                {stripIds(a.effort_summary)}
              </div>
            </div>
          ))}
        </section>
      )}

      {nextActions?.long_term_considerations && nextActions.long_term_considerations.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <h2
            style={{
              fontSize: '14px',
              fontWeight: 700,
              borderBottom: '1px solid #cbd5e1',
              paddingBottom: 4,
              marginBottom: 10,
            }}
          >
            中長期で意識すること
          </h2>
          <ul style={{ paddingLeft: 18, margin: 0 }}>
            {nextActions.long_term_considerations.map((c, i) => (
              <li key={i} style={{ marginBottom: 4 }}>
                {stripIds(c)}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section style={{ marginBottom: 24 }}>
        <h2
          style={{
            fontSize: '14px',
            fontWeight: 700,
            borderBottom: '1px solid #cbd5e1',
            paddingBottom: 4,
            marginBottom: 10,
          }}
        >
          チェックリスト状況
        </h2>
        <div style={{ marginBottom: 8, fontSize: '11px', color: '#475569' }}>
          {(['done', 'pending', 'na', 'unanswered'] as const).map((s, i) => (
            <span key={s}>
              {STATE_LABEL[s]} <strong>{grouped[s].length}</strong> 件
              {i < 3 ? ' / ' : ''}
            </span>
          ))}
        </div>
        {(['done', 'pending', 'na'] as const).map((state) =>
          grouped[state].length > 0 ? (
            <div key={state} style={{ marginBottom: 10 }}>
              <h3 style={{ fontSize: '12px', fontWeight: 700, margin: '0 0 4px' }}>
                {STATE_LABEL[state]}
              </h3>
              <ul style={{ paddingLeft: 18, margin: 0, fontSize: '11px' }}>
                {grouped[state].map((c) => (
                  <li key={c.id}>{c.label}</li>
                ))}
              </ul>
            </div>
          ) : null,
        )}
      </section>

      {result.source?.pdf_url && (
        <footer
          style={{
            borderTop: '1px solid #cbd5e1',
            paddingTop: 8,
            fontSize: '10px',
            color: '#475569',
          }}
        >
          出典: {result.source.pdf_label ?? '地域防災計画'} ({result.source.pdf_url})
        </footer>
      )}
    </div>
  );
});
