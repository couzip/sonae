/**
 * Sonae Discoverer.
 *
 * 自治体の地域防災計画 PDF を見つける。
 *
 * 戦略 (優先度順):
 *   1. `data/municipalities.yaml` の `disaster_plan_url` (登録済 → 即返答)
 *   2. Playwright で Chromium を直接操作 → 上位検索結果ページから PDF リンク列挙 → LLM で 1 件選択
 *
 * (2) は Google スクレイピングを行うため、本番では Brave Search API 等への切替を推奨 (README に記載)。
 */

import { homedir } from 'node:os';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import type { BrowserContext, Page } from 'rebrowser-playwright';
// rebrowser-playwright: Playwright の binary patch 版。CDP の Runtime.Enable
// リーク等の bot 判定の根本原因を fork レベルで修正している。
// 通常の playwright-extra/stealth は JS パッチだけで CDP リークを塞げない。
import { chromium } from 'rebrowser-playwright';

// 永続 user_data_dir。Cookie / localStorage / fingerprint が累積する。
function persistentProfileDir(): string {
  const dir = join(homedir(), '.config', 'sonae-discovery', 'chromium-profile');
  mkdirSync(dir, { recursive: true });
  return dir;
}

import type { Discoverer, LlmClient, PipelineContext } from '@/lib/core';
import { findByCode } from './municipality';
import type { SonaeQuery, SonaeSource } from './types';

type DiscoverCtx = PipelineContext<SonaeQuery>;

interface DiscovererOptions {
  llm: LlmClient;
  /** Chromium headless モード。Google bot 検出回避のため visible 推奨。 */
  headless?: boolean;
}

export interface PdfCandidate {
  url: string;
  label: string;
}

export function cleanRelativeUrl(s: string | undefined): string {
  if (!s) return '';
  let v = String(s).trim();
  v = v.replace(/^[<>"'`\\]+/, '');
  v = v.replace(/[<>"'`\\,)\]]+$/, '');
  return v;
}

const PICK_JSON_SCHEMA = {
  type: 'json_schema',
  json_schema: {
    name: 'PdfPick',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        pick_index: {
          type: 'integer',
          description: '選んだ PDF の index (0-based)',
        },
        reason: {
          type: 'string',
          description: '選定理由 (50 字程度)',
        },
      },
      required: ['pick_index', 'reason'],
    },
  },
} as const;

export class SonaeDiscoverer implements Discoverer<SonaeQuery, SonaeSource> {
  private readonly llm: LlmClient;

  constructor(private readonly opts: DiscovererOptions) {
    this.llm = opts.llm;
  }

  async discover(query: SonaeQuery, ctx: DiscoverCtx): Promise<SonaeSource> {
    // Path 1: registry pin
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

    // Path 2: Playwright + 1 LLM 呼び出し
    return this.discoverViaBrowser(query, ctx);
  }

  private async discoverViaBrowser(query: SonaeQuery, ctx: DiscoverCtx): Promise<SonaeSource> {
    const fullName = query.prefecture ? `${query.prefecture}${query.city_name}` : query.city_name;
    const searchQuery = `${fullName} 地域防災計画 -filetype:pdf -filetype:doc -filetype:docx`;
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`;

    ctx.emit({
      type: 'phase',
      phase: 'discovery',
      status: 'started',
      message: `${query.city_name} の地域防災計画を探しています`,
    });

    // rebrowser-playwright + system Chrome の組み合わせ。Google bot 判定を回避する 2025 年時点の
    // 最も実績のある構成。userAgent / Sec-CH-UA は手動指定せず、実 Chrome 由来の値を使う
    // (UA とクライアントヒントの不整合自体が bot シグナルになるため)。
    const context: BrowserContext = await chromium.launchPersistentContext(
      persistentProfileDir(),
      {
        channel: 'chrome',
        headless: this.opts.headless ?? false,
        viewport: null,
        locale: 'ja-JP',
        args: ['--disable-blink-features=AutomationControlled'],
        ignoreDefaultArgs: ['--enable-automation'],
      },
    );
    // navigator.webdriver を消すなど追加のシグナル隠蔽。CDP リーク自体は
    // rebrowser-playwright の binary patch で解消済み。
    await context.addInitScript(() => {
      const proto = Object.getPrototypeOf(navigator) as Record<string, unknown>;
      delete proto.webdriver;
    });
    try {
      const page = await context.newPage();

      // (1) Google 検索結果ページを開く
      ctx.emit({ type: 'log', phase: 'discovery', message: 'Google 検索を実行' });
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await this.assertNotCaptcha(page);

      // (2) 上位 organic results URL を抽出
      const topResults = await this.extractTopResults(page);
      if (!topResults.length) {
        throw new Error('Google 検索結果から有効なリンクを抽出できませんでした');
      }
      ctx.emit({
        type: 'log',
        phase: 'discovery',
        message: `候補ページ ${topResults.length} 件: ${topResults
          .slice(0, 3)
          .map((u) => safeHostname(u))
          .join(', ')}`,
      });

      // (3) 上位ページを順に開いて PDF リンクを探す
      let pageUrl = '';
      let pdfs: PdfCandidate[] = [];
      for (const url of topResults.slice(0, 3)) {
        ctx.emit({
          type: 'log',
          phase: 'discovery',
          message: `ページを開く: ${safeHostname(url)}${new URL(url).pathname}`,
        });
        try {
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
          const found = await this.extractPdfLinks(page);
          if (found.length > 0) {
            pageUrl = url;
            pdfs = found;
            ctx.emit({
              type: 'log',
              phase: 'discovery',
              message: `${found.length} 件の PDF リンクを発見`,
            });
            break;
          }
          ctx.emit({
            type: 'log',
            phase: 'discovery',
            message: `(PDF リンク無し → 次の候補へ)`,
          });
        } catch (e: any) {
          ctx.emit({
            type: 'log',
            phase: 'discovery',
            message: `(読み込み失敗: ${String(e?.message ?? e).slice(0, 80)})`,
          });
        }
      }

      if (!pdfs.length) {
        throw new Error('上位 3 ページに PDF リンクが見つかりませんでした');
      }

      // (4) HEAD で到達確認
      const reachable = await this.filterReachable(pdfs, ctx);
      if (!reachable.length) {
        throw new Error(
          `発見した ${pdfs.length} 件すべて到達不能 (HEAD 失敗)。URL 抽出が失敗している可能性`,
        );
      }
      if (reachable.length < pdfs.length) {
        ctx.emit({
          type: 'log',
          phase: 'discovery',
          message: `到達可能 ${reachable.length}/${pdfs.length} 件 (残りは HEAD 失敗で除外)`,
        });
      }

      // (5) LLM で本編 1 件を選択 (1 件しか無ければ skip)
      const target =
        reachable.length === 1 ? reachable[0]! : await this.pickViaLlm(reachable, query, ctx);

      ctx.emit({
        type: 'phase',
        phase: 'discovery',
        status: 'done',
        message: `${reachable.length} 件発見 → ${target.label.slice(0, 60)}`,
        data: reachable.slice(0, 5),
      });

      return {
        pdf_url: target.url,
        page_url: pageUrl || undefined,
        pdf_label: target.label,
        section_hint: '被害想定',
      };
    } finally {
      await context.close().catch(() => {
        /* ignore */
      });
    }
  }

  private async assertNotCaptcha(page: Page): Promise<void> {
    const url = page.url();
    if (
      url.includes('sorry.google.com') ||
      url.includes('consent.google.com') ||
      url.includes('captcha')
    ) {
      throw new Error(`Google が bot 検出 (${safeHostname(url)})。手動で reCAPTCHA を解決してください`);
    }
  }

  /**
   * Google 検索結果ページから organic results の URL を上位順で取得する。
   * <h3> の祖先 <a href="..."> を辿る方式。Google の DOM 変更に対する耐性のため
   * 複数 selector を試す。
   */
  private async extractTopResults(page: Page): Promise<string[]> {
    return await page.evaluate(() => {
      const seen: Record<string, boolean> = {};
      const out: string[] = [];
      const candidates: string[] = [];
      const h3s = document.querySelectorAll('h3');
      for (let i = 0; i < h3s.length; i++) {
        const a = h3s[i].closest('a[href]') as HTMLAnchorElement | null;
        if (a) candidates.push(a.href);
      }
      const fallback = document.querySelectorAll('.yuRUbf > a[href], .tF2Cxc a[href]');
      for (let i = 0; i < fallback.length; i++) {
        candidates.push((fallback[i] as HTMLAnchorElement).href);
      }
      for (let i = 0; i < candidates.length; i++) {
        const raw = candidates[i];
        if (!raw || seen[raw]) continue;
        try {
          const u = new URL(raw, 'https://www.google.com/');
          if (
            u.hostname.endsWith('.google.com') ||
            u.hostname === 'google.com' ||
            u.hostname.endsWith('.googleusercontent.com')
          ) {
            continue;
          }
          if (u.protocol !== 'http:' && u.protocol !== 'https:') continue;
          seen[raw] = true;
          out.push(u.href);
        } catch {
          /* skip invalid */
        }
      }
      return out;
    });
  }

  /** 現在のページから <a href="*.pdf"> リンクを抽出。 */
  private async extractPdfLinks(page: Page): Promise<PdfCandidate[]> {
    return await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href]')) as HTMLAnchorElement[];
      const seen = new Set<string>();
      const out: { url: string; label: string }[] = [];
      for (const a of links) {
        const href = a.href;
        if (!href) continue;
        // 拡張子 (クエリ文字列より前) で .pdf 判定
        try {
          const u = new URL(href);
          const path = u.pathname.toLowerCase();
          if (!path.endsWith('.pdf')) continue;
          if (seen.has(u.href)) continue;
          seen.add(u.href);
          const text = (a.textContent || '').replace(/\s+/g, ' ').trim();
          const title = a.getAttribute('title') ?? '';
          const label = text || title || decodeURIComponent(u.pathname.split('/').pop() || u.href);
          out.push({ url: u.href, label });
        } catch {
          /* skip invalid url */
        }
      }
      return out;
    });
  }

  private async filterReachable(
    pdfs: PdfCandidate[],
    ctx: DiscoverCtx,
  ): Promise<PdfCandidate[]> {
    const results = await Promise.all(
      pdfs.map(async (p) => {
        try {
          const r = await fetch(p.url, {
            method: 'HEAD',
            redirect: 'follow',
            signal: ctx.signal,
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
                '(KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36',
            },
          });
          return r.ok ? p : null;
        } catch {
          return null;
        }
      }),
    );
    return results.filter((p): p is PdfCandidate => p !== null);
  }

  private async pickViaLlm(
    pdfs: PdfCandidate[],
    query: SonaeQuery,
    ctx: DiscoverCtx,
  ): Promise<PdfCandidate> {
    const fullName = query.prefecture ? `${query.prefecture}${query.city_name}` : query.city_name;
    const list = pdfs
      .map((p, i) => `${i}. label: ${p.label}\n   url: ${p.url}`)
      .join('\n\n');

    const prompt = `${fullName} の地域防災計画について、以下の PDF 一覧から「被害想定が記載されている本編」を 1 つ選んでください。

## 本編の定義
- ラベルやファイル名に「本編」「計画編」「対策編」「総則」「予防計画」「ダイジェスト」「概要」を含む
- 数百ページ規模の本体ファイル
- 全災害種別を網羅、または被害想定を含む

## 除外 (本編ではない)
- **表紙・目次しか入っていない分冊** (例: ラベルが「表紙」「目次」「表紙・目次」のみ)。ただし 「表紙・目次・共通編」 のように本文 (共通編/総則/計画編/対策編 等) を併記している場合は本文を含むので除外しない
- 「修正の概要」「新旧対照」「変更点」「差分」「改定の概要」 → 改訂差分
- 「資料編」「様式集」「校区」「地区」「水防」「避難計画」 → 付属資料・付録
- 災害応急対策 / 応急対応 / 災害復旧 / 復興 → 発災後の対応マニュアルで被害想定は含まれない

## 巻 / 災害種別ごとに分冊されている場合
被害想定の章は **総則 / 第1部 / 第1編 / 共通編** にほぼ確実に書かれている。優先順位は厳密に:

1. **総則 / 第1部 / 第1編 / 共通編** ← 最優先
2. **地震対策編 / 風水害対策編** など災害種別ごとの対策編
3. **本編 / 計画編 / 全編**

「総則」と「災害予防計画」の両方が候補にある場合は **必ず総則を選ぶ** (災害予防計画には被害想定は通常含まれない)。
「第1部 総則」と「第2部 災害予防」が並んでいたら → 第1部 総則。

## 候補
${list}

## 出力
pick_index に 0..${pdfs.length - 1} の整数で 1 件選び、reason に簡潔な選定理由を書いてください。`;

    try {
      const t0 = Date.now();
      const result = await this.llm.chatJson<{ pick_index: number; reason: string }>({
        prompt,
        responseFormat: PICK_JSON_SCHEMA,
      });
      const dt = ((Date.now() - t0) / 1000).toFixed(1);
      const idx = Math.max(0, Math.min(pdfs.length - 1, Number(result.pick_index) || 0));
      ctx.emit({
        type: 'log',
        phase: 'discovery',
        message: `LLM pick (${dt}s): "${pdfs[idx]!.label.slice(0, 50)}" - ${result.reason.slice(0, 80)}`,
      });
      return pdfs[idx]!;
    } catch (e: any) {
      ctx.emit({
        type: 'log',
        phase: 'discovery',
        message: `LLM pick 失敗 (${String(e?.message ?? e).slice(0, 80)}) → 1 件目を採用`,
      });
      return pdfs[0]!;
    }
  }
}

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}
