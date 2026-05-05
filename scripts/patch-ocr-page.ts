/**
 * 単発スクリプト: 指定 PDF の指定ページを render → OCR → 既存 OCR cache に追記。
 *
 * usage: npx tsx scripts/patch-ocr-page.ts <code> <page,page,page,...>
 *   例:   npx tsx scripts/patch-ocr-page.ts 14100 18
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { createLlmClient, renderPages } from '@/lib/core';

async function main() {
  const [, , code, pagesArg] = process.argv;
  if (!code || !pagesArg) {
    console.error('usage: tsx scripts/patch-ocr-page.ts <code> <p1,p2,...>');
    process.exit(1);
  }
  const pages = pagesArg.split(',').map((s) => Number(s.trim())).filter(Number.isFinite);
  if (!pages.length) {
    console.error('no valid pages');
    process.exit(1);
  }

  const root = process.env.SONAE_CACHE_DIR
    ? resolve(process.env.SONAE_CACHE_DIR)
    : join(process.cwd(), 'cache');

  const pdfPath = join(root, 'pdfs', `${code}.pdf`);
  const mdPath = join(root, 'ocr', `${code}.md`);
  const metaPath = join(root, 'ocr', `${code}.meta.json`);
  const workDir = join(root, 'work', `${code}_patch_${Date.now()}`);
  mkdirSync(workDir, { recursive: true });

  const ocr = createLlmClient({
    baseURL: process.env.OCR_BASE_URL ?? 'http://localhost:1234/v1',
    apiKey: process.env.OCR_API_KEY ?? 'not-needed',
    model: process.env.OCR_MODEL ?? 'enginil/dots.mocr',
  });

  const OCR_PROMPT =
    'この日本語のページをMarkdownで書き起こしてください。' +
    '見出しは # / ## / ### を使い、箇条書きは - を使う。' +
    '図・表は [図: 簡潔な説明] と書いてください。' +
    'ページ番号やヘッダー/フッターは無視。本文を一字一句正確に。';

  console.log(`render pages ${pages.join(', ')} from ${pdfPath}`);
  const rendered = await renderPages(pdfPath, workDir, pages, 2.5);
  rendered.sort((a, b) => a.pageNum - b.pageNum);

  const newSnippets: { pageNum: number; text: string }[] = [];
  for (const r of rendered) {
    console.log(`OCR page ${r.pageNum} ...`);
    const buf = readFileSync(r.path);
    const b64 = buf.toString('base64');
    const raw = await ocr.chatVision({ prompt: OCR_PROMPT, imageBase64: b64 });
    const cleaned = raw.replace(/<\|endof(text|assistant|message)\|>/gi, '').trim();
    newSnippets.push({ pageNum: r.pageNum, text: cleaned });
    console.log(`  → ${cleaned.length} chars`);
  }

  const oldMd = readFileSync(mdPath, 'utf-8');
  const appendix = newSnippets
    .map((s) => `\n\n<!-- page ${s.pageNum} -->\n${s.text}`)
    .join('');
  writeFileSync(mdPath, oldMd + appendix, 'utf-8');
  console.log(`appended to ${mdPath}`);

  const meta = JSON.parse(readFileSync(metaPath, 'utf-8'));
  const merged = Array.from(
    new Set([...(meta.scanned_pages ?? []), ...newSnippets.map((s) => s.pageNum)]),
  ).sort((a: number, b: number) => a - b);
  meta.scanned_pages = merged;
  meta.section.page_count = merged.length;
  writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
  console.log(`updated meta scanned_pages = [${merged.join(', ')}]`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
