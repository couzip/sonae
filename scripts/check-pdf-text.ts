/**
 * PDF の指定ページの text-layer を抽出して確認するための単発 script。
 * usage: npx tsx scripts/check-pdf-text.ts <code> <p1,p2,...>
 */

import { join, resolve } from 'node:path';
import { extractPdfText } from '@/lib/core';

async function main() {
  const [, , code, pagesArg] = process.argv;
  if (!code || !pagesArg) {
    console.error('usage: tsx scripts/check-pdf-text.ts <code> <p1,p2,...>');
    process.exit(1);
  }
  const pages = pagesArg.split(',').map((s) => Number(s.trim())).filter(Number.isFinite);

  const root = process.env.SONAE_CACHE_DIR
    ? resolve(process.env.SONAE_CACHE_DIR)
    : join(process.cwd(), 'cache');
  const pdfPath = join(root, 'pdfs', `${code}.pdf`);

  const text = await extractPdfText(pdfPath, pages);
  for (const p of pages) {
    const t = text[p] ?? '';
    console.log(`=== page ${p} (${t.length} chars) ===`);
    console.log(t.slice(0, 500));
    console.log();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
