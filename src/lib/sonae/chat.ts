import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tool, type ToolSet } from 'ai';
import { z } from 'zod';
import { filterByDisaster } from './client/countermeasures-filter';
import { disasterJpToEnum } from './client/disaster-mapping';
import { loadCountermeasures } from './countermeasures';
import { readSonaeResult } from './pipeline';

export interface ChatContext {
  municipality: { code: string; name: string; prefecture: string };
}

interface PlanChunk {
  heading: string;
  body: string;
  page: number | null;
}

const PAGE_MARKER_RE = /^(?:<!--\s*)?p\.?\s*(\d+)\b/i;
const HEADING_RE = /^#{1,4}\s/;

function planMarkdownPath(code: string): string {
  const root = process.env.SONAE_CACHE_DIR ?? join(process.cwd(), 'cache');
  return join(root, 'ocr', `${code}.md`);
}

function loadPlanMarkdown(code: string): string | null {
  const path = planMarkdownPath(code);
  if (!existsSync(path)) return null;
  return readFileSync(path, 'utf-8');
}

export function chunkPlanMarkdown(md: string): PlanChunk[] {
  const lines = md.split(/\r?\n/);
  const chunks: PlanChunk[] = [];
  let heading = '(冒頭)';
  let body = '';
  let firstPageInChunk: number | null = null;

  const flush = () => {
    if (body.trim().length > 0) chunks.push({ heading, body, page: firstPageInChunk });
  };

  for (const line of lines) {
    const pageMatch = line.match(PAGE_MARKER_RE);
    if (pageMatch?.[1] && firstPageInChunk === null) {
      firstPageInChunk = parseInt(pageMatch[1], 10);
    }
    if (HEADING_RE.test(line)) {
      flush();
      heading = line.replace(/^#{1,4}\s*/, '').trim();
      body = '';
      firstPageInChunk = null;
    } else {
      body += line + '\n';
    }
  }
  flush();
  return chunks;
}

function bigrams(s: string): Map<string, number> {
  const out = new Map<string, number>();
  const t = s.toLowerCase();
  for (let i = 0; i < t.length - 1; i++) {
    const bi = t.slice(i, i + 2);
    if (/\s/.test(bi)) continue;
    out.set(bi, (out.get(bi) ?? 0) + 1);
  }
  return out;
}

export function bigramOverlap(query: string, text: string): number {
  const q = bigrams(query);
  if (q.size === 0) return 0;
  const t = bigrams(text);
  let hits = 0;
  let total = 0;
  for (const [bi, count] of q) {
    total += count;
    hits += Math.min(count, t.get(bi) ?? 0);
  }
  return total > 0 ? hits / total : 0;
}

const SNIPPET_MAX = 400;

function snippet(body: string): string {
  const trimmed = body.trim();
  return trimmed.length <= SNIPPET_MAX ? trimmed : trimmed.slice(0, SNIPPET_MAX) + '…';
}

export function buildChatTools(ctx: ChatContext): ToolSet {
  const code = ctx.municipality.code;

  return {
    list_disaster_types: tool({
      description:
        'この自治体で地域防災計画に記載のある災害種別の一覧を返す。各種別ごとのシナリオ件数も付与する。',
      inputSchema: z.object({}),
      execute: async () => {
        const result = await readSonaeResult(code);
        if (!result) {
          return { error: 'no assessment cached for this municipality. run /api/disasters first.' };
        }
        const types = result.by_disaster_type
          .filter((d) => d.scenarios.length > 0)
          .map((d) => ({ disaster_type: d.disaster_type, scenario_count: d.scenarios.length }));
        return { municipality: ctx.municipality.name, types };
      },
    }),

    get_disaster_scenarios: tool({
      description:
        '指定した災害種別のシナリオ詳細 (規模、想定被害、想定/実績) を返す。list_disaster_types で確認できた種別を渡すこと。',
      inputSchema: z.object({
        disaster_type: z
          .string()
          .describe('list_disaster_types で返された disaster_type 文字列をそのまま渡す'),
      }),
      execute: async ({ disaster_type }) => {
        const result = await readSonaeResult(code);
        if (!result) return { error: 'no assessment cached' };
        const target = result.by_disaster_type.find((d) => d.disaster_type === disaster_type);
        if (!target) return { error: `disaster_type "${disaster_type}" not found` };
        return { disaster_type, scenarios: target.scenarios };
      },
    }),

    search_disaster_plan: tool({
      description:
        '自治体の地域防災計画 (被害想定章) の OCR 全文をキーワード検索し、関連する見出し+本文スニペット+ページ番号を上位 N 件返す。' +
        'パラフレーズで質問された語をそのまま検索しても良い。複数キーワードは OR 検索。',
      inputSchema: z.object({
        keywords: z
          .array(z.string().min(1))
          .min(1)
          .max(8)
          .describe('検索キーワード配列。日本語で構わない。'),
        top_k: z.number().int().min(1).max(10).default(5),
      }),
      execute: async ({ keywords, top_k }) => {
        const md = loadPlanMarkdown(code);
        if (md === null) return { error: 'no OCR cache for this municipality' };
        const chunks = chunkPlanMarkdown(md);
        const query = keywords.join(' ');
        const ranked = chunks
          .map((c) => ({ chunk: c, score: bigramOverlap(query, c.heading + ' ' + c.body) }))
          .filter(({ score }) => score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, top_k)
          .map(({ chunk, score }) => ({
            heading: chunk.heading,
            page: chunk.page,
            snippet: snippet(chunk.body),
            score: Number(score.toFixed(3)),
          }));
        return { query: keywords, hits: ranked };
      },
    }),

    list_countermeasures_for_disaster: tool({
      description:
        '指定した災害種別 (および全災害共通の対策) に該当する対策の一覧を返す。' +
        '詳細が必要なら lookup_countermeasure を続けて呼ぶ。',
      inputSchema: z.object({
        disaster_type: z
          .string()
          .describe('日本語の災害種別 (例: 地震 / 津波 / 洪水)。enum マッピング後にフィルタする。'),
      }),
      execute: async ({ disaster_type }) => {
        const master = loadCountermeasures();
        const enumKey = disasterJpToEnum(disaster_type);
        const filtered = filterByDisaster(master, [enumKey], enumKey);
        return {
          disaster_type,
          items: filtered.map((c) => ({
            id: c.id,
            label: c.label,
            short_description: c.short_description ?? null,
            impact: c.impact,
            effort: c.effort,
          })),
        };
      },
    }),

    lookup_countermeasure: tool({
      description:
        '74 項目対策マスターから ID で対策の詳細 (なぜ必要か / どうやるか / 参考リンク) を取得する。',
      inputSchema: z.object({
        id: z.string().describe('対策 ID (例: eq_furniture_securing)'),
      }),
      execute: async ({ id }) => {
        const master = loadCountermeasures();
        const cm = master.find((c) => c.id === id);
        if (!cm) return { error: `countermeasure id "${id}" not found` };
        return cm;
      },
    }),
  };
}

export const CHAT_SYSTEM_PROMPT = `あなたは Sonae の防災アシスタントです。ユーザーは既に自分の自治体の地域防災計画を解析済みで、被害想定とシナリオを把握しています。
その上で出てくる具体的な疑問に、根拠付きで答えてください。

ルール:
- 推測で答えない。確証が必要なら必ず tools を呼び、結果に基づいて答える。
- 災害種別の話題が出たら list_disaster_types または get_disaster_scenarios で根拠取得。
- 個別の質問は search_disaster_plan で計画 PDF 該当箇所を引用。
- 対策の話題は list_countermeasures_for_disaster → lookup_countermeasure の順で詳細を取得。
- 回答末尾に出典を箇条書き (見出し / ページ番号 / 対策 ID 等) で示す。
- ユーザー向けテキストに対策 ID (英数字+アンダースコア) を裸で書かない。日本語ラベルだけ使う。
- 答えが計画書 / 対策マスターのどちらにも見つからない場合は、見つからない旨を明示する。

書式ルール (厳守):
- LaTeX / TeX の数式記法は使わない。\\rightarrow / \\leftarrow / \\to / $...$ / \\(...\\) は禁止。
- 矢印は → ← ↑ ↓ をそのままテキストで書く。
- 数式は使わない。必要なら平易な日本語で表現する。
- 出力は GitHub Flavored Markdown のみ (見出し / 箇条書き / 太字 / コード) を使い、それ以外の特殊記法は避ける。`;
