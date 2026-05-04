/**
 * Sonae Discoverer.
 *
 * Resolves a municipality query into the URL of its disaster-plan PDF.
 *
 * Strategy (high → low priority):
 *   1. `data/municipalities.yaml` registry has `disaster_plan_url`     (zero-cost, deterministic)
 *   2. browser-use Agent searches Google for the official site         (fallback, slower)
 *   3. Heuristic ranking via `pickTarget` to choose the right PDF
 *
 * The Google fallback violates Google ToS in production; documented in README.
 * Brave Search API is the planned replacement.
 */

import { Agent, type AgentHistory } from 'browser-use';
import { ChatOpenAI } from 'browser-use/llm/openai';
import { BrowserSession, BrowserProfile } from 'browser-use/browser';

import type { Discoverer, PipelineContext } from '@/lib/core';
import { findByCode } from './municipality';
import { PDF_LIST_JSON_SCHEMA, type PdfList } from './schemas';
import type { SonaeQuery, SonaeSource } from './types';

type DiscoverCtx = PipelineContext<SonaeQuery>;

interface DiscovererOptions {
  /** OpenAI-compatible base URL for browser-use's internal LLM (planning agent). */
  llmBaseURL: string;
  llmApiKey: string;
  llmModel: string;
  /** Run Chromium headless. Default true. */
  headless?: boolean;
}

const pdfListParser = {
  parse: (s: string) => JSON.parse(s),
  model_validate_json: (s: string) => JSON.parse(s),
  model_json_schema: () => PDF_LIST_JSON_SCHEMA.json_schema.schema,
  schema: PDF_LIST_JSON_SCHEMA.json_schema.schema,
};

export function cleanRelativeUrl(s: string | undefined): string {
  if (!s) return '';
  let v = String(s).trim();
  v = v.replace(/^[<>"'`\\]+/, '');
  v = v.replace(/[<>"'`\\,)\]]+$/, '');
  return v;
}

interface PdfCandidate {
  url: string;
  label: string;
}

/** Score-and-pick the most likely "main plan PDF" out of a list. */
export function pickTarget(pdfs: PdfCandidate[], pageUrl: string): PdfCandidate {
  const norm = pdfs
    .map((p) => {
      try {
        return {
          url: new URL(cleanRelativeUrl(p.url), pageUrl || 'https://example.com/').href,
          label: p.label || p.url,
        };
      } catch {
        return null;
      }
    })
    .filter((p): p is PdfCandidate => !!p && p.url.toLowerCase().endsWith('.pdf'));

  if (!norm.length) throw new Error('No PDF candidates');

  const score = (p: PdfCandidate): number => {
    let s = 0;
    const lab = p.label;
    // Reject diff/revision PDFs outright — these are not the plan body.
    if (
      lab.includes('修正の概要') ||
      lab.includes('修正部分') ||
      lab.includes('新旧対照') ||
      lab.includes('変更点') ||
      lab.includes('差分') ||
      lab.includes('改定の概要')
    ) {
      return -1000;
    }
    if (lab.includes('概要')) s += 100;
    if (lab.includes('本編')) s += 120;
    if (lab.includes('対策編')) s += 100;
    if (lab.includes('計画編')) s += 100;
    if (lab.includes('一括')) s += 30;
    if (lab.includes('ダイジェスト')) s += 40;
    if (lab.includes('資料')) s -= 50;
    if (lab.includes('水防')) s -= 30;
    if (lab.includes('校区') || lab.includes('地区') || lab.includes('校')) s -= 60;
    if (lab.includes('様式')) s -= 100;
    if (lab.includes('避難')) s -= 50;
    if (/^https?:\/\/[^/]*\.go\.jp/i.test(p.url)) s -= 100;
    return s;
  };
  return norm.reduce((a, b) => (score(a) >= score(b) ? a : b));
}

export class SonaeDiscoverer implements Discoverer<SonaeQuery, SonaeSource> {
  constructor(private readonly opts: DiscovererOptions) {}

  async discover(query: SonaeQuery, ctx: DiscoverCtx): Promise<SonaeSource> {
    // Path 1: registry lookup — preferred
    const muni = findByCode(query.municipality_code);
    if (muni?.disaster_plan_url) {
      ctx.emit({
        type: 'log',
        phase: 'discovery',
        message: `[Registry] ${muni.disaster_plan_label ?? muni.name} → ${muni.disaster_plan_url}`,
      });
      return {
        pdf_url: muni.disaster_plan_url,
        page_url: muni.disaster_plan_page_url,
        pdf_label: muni.disaster_plan_label ?? `${muni.name}地域防災計画`,
        section_hint: '被害想定',
      };
    }

    // Path 2: browser-use fallback
    return this.discoverViaBrowser(query, ctx);
  }

  private async discoverViaBrowser(query: SonaeQuery, ctx: DiscoverCtx): Promise<SonaeSource> {
    ctx.emit({
      type: 'phase',
      phase: 'discovery',
      status: 'started',
      message: `${query.city_name} の地域防災計画 PDF を browser-use で探索`,
    });

    const llm = new ChatOpenAI({
      model: this.opts.llmModel,
      baseURL: this.opts.llmBaseURL,
      apiKey: this.opts.llmApiKey,
      temperature: 0.1,
      addSchemaToSystemPrompt: false,
      dontForceStructuredOutput: false,
      removeMinItemsFromSchema: true,
      removeDefaultsFromSchema: true,
      maxCompletionTokens: 2048,
      timeout: 600_000,
    });
    const profile = new BrowserProfile({ headless: this.opts.headless ?? true });
    const session = new BrowserSession({ browser_profile: profile });

    const TASK = `あなたはブラウザ調査エージェントです。
目的: ${query.city_name} の地域防災計画(本編・概要版・各編どれでもよい)のPDFリンクを公式サイトの記事HTMLページから列挙する。

【絶対遵守】
- PDFリンクはクリックしない
- read_file は呼ばない
- click するのは公式サイトの HTMLページ へのリンクのみ

【手順】
1. https://www.google.com/search?q=${encodeURIComponent(query.city_name + ' 地域防災計画')} を開く
2. 検索結果から ${query.city_name} の公式ドメインの HTML 記事ページを1つクリック
3. 着地ページの全PDFリンクを find_elements か extract で取得
4. done で結果を返す。スキーマ通り page_url と pdfs[] を埋めること。`;

    const agent = new Agent({
      task: TASK,
      llm,
      browser_session: session,
      output_model_schema: pdfListParser,
      use_vision: false,
      use_thinking: false,
      flash_mode: true,
      use_judge: false,
      enable_planning: false,
      max_failures: 3,
      max_actions_per_step: 2,
    });

    let listing: PdfList;
    try {
      const history = (await agent.run(15)) as AgentHistory;
      listing = await this.parseAgentResult(history, ctx);
    } finally {
      try {
        await session.kill?.();
      } catch {
        /* ignore */
      }
    }

    if (!listing.pdfs.length) {
      throw new Error('Phase 1: PDF が見つからない');
    }

    const target = pickTarget(listing.pdfs, listing.page_url);
    ctx.emit({
      type: 'phase',
      phase: 'discovery',
      status: 'done',
      message: `${listing.pdfs.length} 件発見 → ${target.label.slice(0, 60)}`,
      data: listing.pdfs.slice(0, 5),
    });
    return {
      pdf_url: target.url,
      page_url: listing.page_url || undefined,
      pdf_label: target.label,
      section_hint: '被害想定',
    };
  }

  private async parseAgentResult(history: AgentHistory, ctx: DiscoverCtx): Promise<PdfList> {
    // 1. structured_output 即採用
    try {
      const so = (history as any).structured_output as PdfList | undefined;
      if (so?.pdfs?.length) return so;
    } catch {
      /* fall through */
    }

    // 2. final_result が JSON っぽければパース
    const final = String(history.final_result?.() ?? '');
    const m = final.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        const parsed = JSON.parse(m[0]);
        if (Array.isArray(parsed.pdfs) && parsed.pdfs.length) return parsed as PdfList;
      } catch {
        /* fall through */
      }
    }

    // 3. blob fallback parsing (extracted_content / model_actions / agent_steps)
    const blobs: string[] = [];
    try {
      const ec = history.extracted_content?.() ?? [];
      for (const c of ec) if (c) blobs.push(String(c));
    } catch (e: any) {
      ctx.emit({
        type: 'log',
        phase: 'discovery',
        message: `(extracted_content failed: ${e?.message})`,
      });
    }
    try {
      const ar = history.action_results?.() ?? [];
      for (const r of ar) {
        if (r?.extracted_content) blobs.push(String(r.extracted_content));
        if (r?.long_term_memory) blobs.push(String(r.long_term_memory));
      }
    } catch (e: any) {
      ctx.emit({
        type: 'log',
        phase: 'discovery',
        message: `(action_results failed: ${e?.message})`,
      });
    }
    let modelActionsText = '';
    try {
      modelActionsText = JSON.stringify(history.model_actions?.() ?? []);
    } catch {
      /* ignore */
    }
    const steps = (history.agent_steps?.() ?? []).join('\n');
    const text = blobs.join('\n') + '\n' + modelActionsText + '\n' + steps + '\n' + final;
    const visitedUrls = history.urls?.() ?? [];
    const baseUrl = visitedUrls.filter((u) => u && u !== 'about:blank').at(-1) ?? '';
    ctx.emit({
      type: 'log',
      phase: 'discovery',
      message: `fallback parse: blobs=${blobs.length} text=${text.length}文字 base=${baseUrl.slice(0, 60)}`,
    });

    const sr = text.match(/<structured_result>\s*([\s\S]+?)\s*<\/structured_result>/);
    if (sr) {
      try {
        const j = JSON.parse(sr[1]);
        if (Array.isArray(j.pdfs) && j.pdfs.length) {
          const resolved = j.pdfs
            .map((p: any) => {
              try {
                return {
                  url: new URL(
                    cleanRelativeUrl(p.url),
                    baseUrl || j.page_url || 'https://example.com/',
                  ).href,
                  label: p.label || p.url,
                };
              } catch {
                return null;
              }
            })
            .filter(Boolean) as PdfCandidate[];
          if (resolved.length) return { page_url: baseUrl || j.page_url || '', pdfs: resolved };
        }
      } catch {
        /* fall through */
      }
    }

    const pdfs: PdfCandidate[] = [];
    const seen = new Set<string>();
    const anchorRe = /<a>[^<>]*?text="([^"]+?)"[^<>]*?href="([^"]+?\.pdf)"/gi;
    let m2: RegExpExecArray | null;
    while ((m2 = anchorRe.exec(text)) !== null) {
      try {
        const abs = new URL(cleanRelativeUrl(m2[2]), baseUrl || 'https://example.com/').href;
        if (!seen.has(abs)) {
          seen.add(abs);
          pdfs.push({ url: abs, label: m2[1] });
        }
      } catch {
        /* ignore */
      }
    }
    const urlRe = /(?:https?:\/\/[^\s<>"'`]+?\.pdf|[\w.\-/]+\.pdf)/gi;
    while ((m2 = urlRe.exec(text)) !== null) {
      const raw = m2[0].replace(/[)\].,'"]+$/, '');
      try {
        const abs = new URL(cleanRelativeUrl(raw), baseUrl || 'https://example.com/').href;
        if (!seen.has(abs) && abs.toLowerCase().endsWith('.pdf')) {
          seen.add(abs);
          pdfs.push({ url: abs, label: decodeURIComponent(abs.split('/').pop() ?? abs) });
        }
      } catch {
        /* ignore */
      }
    }

    if (!pdfs.length && baseUrl) {
      ctx.emit({
        type: 'log',
        phase: 'discovery',
        message: `agent did not return links → fetch baseUrl HTML directly`,
      });
      try {
        const r = await fetch(baseUrl, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36',
          },
          redirect: 'follow',
        });
        if (r.ok) {
          const html = await r.text();
          const aRe = /<a\s[^>]*?href=["']([^"']+?\.pdf)["'][^>]*?>([\s\S]*?)<\/a>/gi;
          let m3: RegExpExecArray | null;
          while ((m3 = aRe.exec(html)) !== null) {
            try {
              const abs = new URL(cleanRelativeUrl(m3[1]), baseUrl).href;
              if (!seen.has(abs)) {
                seen.add(abs);
                const label =
                  m3[2]
                    .replace(/<[^>]+>/g, '')
                    .replace(/\s+/g, ' ')
                    .trim() || decodeURIComponent(abs.split('/').pop() ?? abs);
                pdfs.push({ url: abs, label });
              }
            } catch {
              /* ignore */
            }
          }
        }
      } catch (e: any) {
        ctx.emit({
          type: 'log',
          phase: 'discovery',
          message: `fetch failed: ${e?.message}`,
        });
      }
    }

    return { page_url: baseUrl, pdfs };
  }
}
