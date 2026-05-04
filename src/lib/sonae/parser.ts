/**
 * Sonae Parser.
 *
 * Phases 3 & 4 combined into one Parser:
 *   3. Read TOC text → LLM picks the target section ("被害想定")
 *   4. text-layer keyword scan → candidate pages → OCR for headline confirmation
 *      → high-resolution OCR for the section body
 *
 * Output: a `SonaeParsed` containing the OCR'd markdown body and metadata.
 */

import { readFileSync, writeFileSync } from 'node:fs';

import {
  extractPdfText,
  getPdfPageCount,
  hasUsefulTextLayer,
  renderPages,
  type LlmClient,
  type Parser,
  type PipelineContext,
  type RenderedPage,
} from '@/lib/core';
import { TOC_JSON_SCHEMA, type TocSelection } from './schemas';
import type { SonaeBlob, SonaeParsed, SonaeQuery, SonaeSource } from './types';

export const TOC_SCAN_PAGES = 12;

const OCR_PROMPT =
  'この日本語のページをMarkdownで書き起こしてください。' +
  '見出しは # / ## / ### を使い、箇条書きは - を使う。' +
  '図・表は [図: 簡潔な説明] と書いてください。' +
  'ページ番号やヘッダー/フッターは無視。本文を一字一句正確に。';

const norm = (s: string) =>
  s
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xff10 + 0x30))
    .replace(/[\s　・,。、()（）]/g, '');

/** Convert chandra-style HTML+bbox output to clean markdown. */
function chandraHtmlToMarkdown(s: string): string {
  if (!s || !/<\/?(div|h[1-6]|p|br)\b/i.test(s)) return s;
  return s
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n# $1\n')
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n')
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n')
    .replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '\n#### $1\n')
    .replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, '\n##### $1\n')
    .replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, '\n###### $1\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(p|div)[^>]*>/gi, '\n')
    .replace(/<img[^>]*alt="([^"]*)"[^>]*>/gi, '[図: $1]')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export interface ParserOptions {
  llm: LlmClient;
  ocr: LlmClient;
  /**
   * Build a workspace directory for ephemeral artifacts (TOC.md, page PNGs,
   * intermediate OCR markdown). Receives the municipality code and the PDF
   * sha256 so callers can shape the path however they like.
   */
  workDirFor: (municipalityCode: string, sourceSha256: string) => string;
}

export class SonaeTocOcrParser implements Parser<SonaeBlob, SonaeParsed, SonaeQuery, SonaeSource> {
  constructor(private readonly opts: ParserOptions) {}

  async parse(
    blob: SonaeBlob,
    ctx: PipelineContext<SonaeQuery, SonaeSource>,
  ): Promise<SonaeParsed> {
    const source = ctx.source;
    if (!source) throw new Error('SonaeTocOcrParser: ctx.source is missing');
    const code = ctx.query?.municipality_code;
    if (!code) throw new Error('SonaeTocOcrParser: ctx.query.municipality_code missing');
    const work = this.opts.workDirFor(code, blob.sha256);

    // -- Phase 3a: extract TOC text layer --
    const totalPages = await getPdfPageCount(blob.pdf_path);
    ctx.emit({ type: 'log', message: `総ページ数: ${totalPages}` });

    ctx.emit({ type: 'phase', phase: 'toc', status: 'started', message: '目次取得 (text layer)' });
    const tocPagesNums = Array.from(
      { length: Math.min(TOC_SCAN_PAGES, totalPages) },
      (_, i) => i + 1,
    );
    const tocText = await extractPdfText(blob.pdf_path, tocPagesNums);
    const usefulToc = tocPagesNums.filter((p) => hasUsefulTextLayer(tocText[p]));
    if (usefulToc.length < Math.ceil(tocPagesNums.length * 0.3)) {
      throw new Error(
        `この PDF はテキスト抽出ができません (${usefulToc.length}/${tocPagesNums.length} pages にしか日本語テキストレイヤがありません)。本アプリは画像のみの PDF をサポートしていません。`,
      );
    }
    const tocMd = tocPagesNums
      .map((p) => `<!-- page ${p} -->\n${tocText[p] || ''}`)
      .join('\n\n')
      .trim();
    writeFileSync(`${work}/toc.md`, tocMd, 'utf-8');

    // -- Phase 3b: LLM picks the target section --
    const section = await this.findTargetSection(tocMd, ctx);
    if (!section) throw new Error('TOC から被害想定の章を特定できなかった');
    ctx.emit({
      type: 'phase',
      phase: 'toc',
      status: 'done',
      message: `セクション特定: ${section.title}`,
    });

    // -- Phase 4: scan text-layer for keyword → OCR candidates → confirm + body OCR --
    const titleNorm = norm(section.title);
    ctx.emit({
      type: 'phase',
      phase: 'ocr_scan',
      status: 'started',
      message: `text-layer 全ページ抽出 (1-${totalPages}p)`,
    });
    const allPageNums = Array.from({ length: totalPages }, (_, i) => i + 1);
    const textByPage = await extractPdfText(blob.pdf_path, allPageNums);
    const candidates: number[] = [];
    for (const p of allPageNums) {
      const tn = norm(textByPage[p] || '');
      if (tn.includes(titleNorm)) candidates.push(p);
    }
    ctx.emit({
      type: 'log',
      phase: 'ocr_scan',
      message: `"${section.title}" ヒット ${candidates.length} ページ: ${candidates.slice(0, 20).join(', ')}${candidates.length > 20 ? '...' : ''}`,
    });
    if (!candidates.length) throw new Error('text-layer ヒットなし → 中断');

    // Phase 4b: render candidates, OCR each, look for the heading
    ctx.emit({
      type: 'phase',
      phase: 'ocr_section',
      status: 'started',
      message: '候補ページ OCR で本文 heading 確定',
    });
    const ocrCache = new Map<number, string>();
    let startPage: number | null = null;
    let startHeading: string | null = null;
    const candImgs = (
      await renderPages(blob.pdf_path, `${work}/candidate_pages`, candidates, 2.5)
    ).sort((a, b) => a.pageNum - b.pageNum);
    for (const { pageNum, path: imgPath } of candImgs) {
      const t0 = Date.now();
      const text = await this.ocrPage(imgPath);
      const dt = ((Date.now() - t0) / 1000).toFixed(1);
      ocrCache.set(pageNum, text);
      const heading = this.findTitleHeading(text, titleNorm);
      ctx.emit({
        type: 'log',
        phase: 'ocr_section',
        message: `page ${pageNum}: ${text.length}文字 (${dt}s) heading: ${heading ?? 'なし'}`,
      });
      if (heading) {
        startPage = pageNum;
        startHeading = heading;
        break;
      }
    }
    if (startPage === null) throw new Error('heading 不検出');
    ctx.emit({
      type: 'log',
      phase: 'ocr_section',
      message: `★ 本文 start = ${startPage} ("${startHeading}")`,
    });

    // Phase 4c: OCR `page_count` pages from startPage
    const targetPageNums: number[] = [];
    for (let i = 0; i < section.page_count; i++) {
      const p = startPage + i;
      if (p <= totalPages) targetPageNums.push(p);
    }
    const remaining = targetPageNums.filter((p) => !ocrCache.has(p));
    let renderedSection: RenderedPage[] = [];
    if (remaining.length) {
      renderedSection = await renderPages(blob.pdf_path, `${work}/target_pages`, remaining, 2.5);
    }
    const collected: { pageNum: number; text: string }[] = [];
    for (const p of targetPageNums) {
      let text = ocrCache.get(p);
      if (!text) {
        const img = renderedSection.find((r) => r.pageNum === p);
        if (!img) continue;
        const t0 = Date.now();
        text = await this.ocrPage(img.path);
        const dt = ((Date.now() - t0) / 1000).toFixed(1);
        ctx.emit({
          type: 'log',
          phase: 'ocr_section',
          message: `page ${p}: ${text.length}文字 (${dt}s) [新規]`,
        });
      } else {
        ctx.emit({
          type: 'log',
          phase: 'ocr_section',
          message: `page ${p}: ${text.length}文字 [キャッシュ]`,
        });
      }
      collected.push({ pageNum: p, text });
    }
    ctx.emit({
      type: 'phase',
      phase: 'ocr_section',
      status: 'done',
      message: `OCR完了: ${collected.length}ページ`,
    });

    const ocr_markdown = collected.map((c) => `<!-- page ${c.pageNum} -->\n${c.text}`).join('\n\n');
    writeFileSync(`${work}/ocr_combined.md`, ocr_markdown, 'utf-8');

    return {
      ocr_markdown,
      section,
      scanned_pages: collected.map((c) => c.pageNum),
      source_sha256: blob.sha256,
      source,
    };
  }

  private async ocrPage(imagePath: string): Promise<string> {
    const buf = readFileSync(imagePath);
    const b64 = buf.toString('base64');
    const raw = await this.opts.ocr.chatVision({ prompt: OCR_PROMPT, imageBase64: b64 });
    const cleaned = raw.replace(/<\|endof(text|assistant|message)\|>/gi, '').trim();
    return chandraHtmlToMarkdown(cleaned);
  }

  private findTitleHeading(text: string, titleNorm: string): string | null {
    for (const line of text.split('\n')) {
      const m = line.match(/^#{1,4}\s+(.+?)\s*$/);
      if (!m) continue;
      const hn = norm(m[1]);
      if (hn.includes(titleNorm) || titleNorm.includes(hn)) return m[1].trim();
    }
    return null;
  }

  private async findTargetSection(
    tocMarkdown: string,
    ctx: PipelineContext,
  ): Promise<{ title: string; page_count: number } | null> {
    const prompt = `以下は地域防災計画の目次をテキスト抽出したものです。
「被害想定」(または同義: 想定する災害, 予想される災害, 被害推計など) を1つだけ選び、
TOC 上の開始ページと、終了ページを返してください。

タイトルは目次に書かれている文字列そのまま、**階層接頭辞 (章/節/項の番号や記号、英数字インデックス) を必ず含めて** 返す。
裸の本文だけは不可。同名タイトルが文書内に複数ある場合に区別できなくなるため。

終了ページは、対象セクションと **同じ階層またはそれより上位** の次の見出しの開始ページから 1 引いた値。
下位の見出し (例: 対象が第N節なら、その中の第N項などの小節) は無視すること。

応急対策・避難・予防の章は選ばない。該当なしなら title="" start=0 end=0。

--- 目次ここから ---
${tocMarkdown}
--- 目次ここまで ---`;

    const parsed = await this.opts.llm.chatJson<TocSelection>({
      prompt,
      responseFormat: TOC_JSON_SCHEMA,
      maxTokens: 256,
    });
    const title = String(parsed.title ?? '')
      .replace(/^#+\s*/, '')
      .trim();
    if (!title) {
      ctx.emit({ type: 'log', phase: 'toc', message: '目次から該当章なし' });
      return null;
    }
    const start = parseInt(String(parsed.logical_start_page)) || 0;
    const end = parseInt(String(parsed.logical_end_page)) || start;
    if (start <= 0) {
      ctx.emit({ type: 'log', phase: 'toc', message: `目次から該当章なし (start=${start})` });
      return null;
    }
    const page_count = Math.max(1, Math.min(80, end - start + 1));
    ctx.emit({
      type: 'log',
      phase: 'toc',
      message: `目次から抽出: "${title}" 論理P${start}-P${end} (${page_count}p)`,
    });
    return { title, page_count };
  }
}
