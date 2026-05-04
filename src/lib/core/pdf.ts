/**
 * Generic PDF helpers built on pdfjs-dist 5.x.
 *
 * Domain-agnostic — usable for any pipeline that needs PDF text extraction or
 * page rendering. Sonae uses these for its Parser layer, but they are not
 * tied to the disaster domain.
 *
 * Reference: Mozilla pdf.js Node.js sample
 * (`pdfjs-dist/examples/node/pdf2png/pdf2png.mjs`).
 *
 * Cross-platform / cross-deploy notes:
 * - `createRequire(import.meta.url).resolve(...)` finds pdfjs-dist regardless
 *   of how the package manager (npm/pnpm/yarn) hoists it.
 * - In Next.js, list `pdfjs-dist` and `@napi-rs/canvas` in
 *   `serverExternalPackages` so webpack does not bundle them.
 * - `cMapUrl` / `standardFontDataUrl` are normalised to `file://` URLs to
 *   avoid Windows backslash issues with the strict pdfjs URL parser.
 */

import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const requireFromHere = createRequire(import.meta.url);
const _pdfjsRoot = dirname(requireFromHere.resolve('pdfjs-dist/package.json'));
const _cMapUrl = pathToFileURL(join(_pdfjsRoot, 'cmaps') + '/').href;
const _standardFontDataUrl = pathToFileURL(join(_pdfjsRoot, 'standard_fonts') + '/').href;

async function loadDocument(pdfPath: string) {
  const data = new Uint8Array(readFileSync(pdfPath));
  return await getDocument({
    data,
    cMapUrl: _cMapUrl,
    cMapPacked: true,
    standardFontDataUrl: _standardFontDataUrl,
    isEvalSupported: false,
  }).promise;
}

export async function getPdfPageCount(pdfPath: string): Promise<number> {
  const doc = await loadDocument(pdfPath);
  const n = doc.numPages;
  await doc.destroy();
  return n;
}

/**
 * Extract the text layer for the requested pages. Pages without a usable text
 * layer return an empty string (use `hasUsefulTextLayer` to detect).
 *
 * Lines are inferred from y-coordinate gaps; the algorithm assumes a roughly
 * top-to-bottom reading order, which holds for typical Japanese government
 * documents.
 */
export async function extractPdfText(
  pdfPath: string,
  pageNums: number[],
): Promise<Record<number, string>> {
  const doc = await loadDocument(pdfPath);
  const out: Record<number, string> = {};
  for (const n of pageNums) {
    if (n < 1 || n > doc.numPages) continue;
    try {
      const page = await doc.getPage(n);
      const tc = await page.getTextContent();
      const lines: string[] = [];
      let cur: string[] = [];
      let lastY: number | null = null;
      for (const item of tc.items as Array<{ str?: string; transform?: number[] }>) {
        const y = item.transform?.[5];
        if (lastY !== null && y !== undefined && Math.abs(y - lastY) > 4) {
          if (cur.length) lines.push(cur.join(''));
          cur = [];
        }
        cur.push(item.str ?? '');
        lastY = y ?? lastY;
      }
      if (cur.length) lines.push(cur.join(''));
      out[n] = lines.join('\n').replace(/ /g, '').trim();
      page.cleanup?.();
    } catch {
      out[n] = '';
    }
  }
  await doc.destroy();
  return out;
}

/**
 * Heuristic: returns true if the text contains enough Japanese (kanji /
 * hiragana / katakana) to be considered a useful text layer.
 *
 * Mere `length` is not enough — PDFs with broken ToUnicode CMaps (custom
 * embedded fonts) emit garbage strings of full length but no real characters.
 *
 * Threshold: 30 characters of Japanese script.
 */
export function hasUsefulTextLayer(text: string | undefined): boolean {
  if (!text) return false;
  const jp = (text.match(/[一-龯ぁ-んァ-ンー]/g) || []).length;
  return jp >= 30;
}

export interface RenderedPage {
  pageNum: number;
  path: string;
}

/**
 * Render the requested pages to PNGs in `outputAbsDir`.
 *
 * Uses pdfjs-dist 5.x's built-in `canvasFactory` — at runtime this auto-detects
 * `@napi-rs/canvas` (which must be installed). No custom canvas factory needed.
 *
 * @param scale viewport scale factor; 2.5 is a good default for OCR (≈ 200 dpi).
 */
export async function renderPages(
  pdfPath: string,
  outputAbsDir: string,
  pageNums: number[],
  scale = 2.5,
): Promise<RenderedPage[]> {
  mkdirSync(outputAbsDir, { recursive: true });
  const doc = await loadDocument(pdfPath);
  const factory: any = (doc as any).canvasFactory;
  if (!factory || typeof factory.create !== 'function') {
    await doc.destroy();
    throw new Error('pdfjs-dist canvasFactory unavailable. Ensure `@napi-rs/canvas` is installed.');
  }
  const out: RenderedPage[] = [];
  try {
    for (const n of pageNums) {
      if (n < 1 || n > doc.numPages) continue;
      const page = await doc.getPage(n);
      const viewport = page.getViewport({ scale });
      const cc = factory.create(viewport.width, viewport.height);
      try {
        await page.render({
          canvasContext: cc.context,
          viewport,
          canvas: cc.canvas,
        }).promise;
        const buf = cc.canvas.toBuffer('image/png');
        const filename = `page_${String(n).padStart(4, '0')}.png`;
        const filepath = join(outputAbsDir, filename);
        writeFileSync(filepath, buf);
        out.push({ pageNum: n, path: filepath });
      } finally {
        page.cleanup?.();
        factory.destroy(cc);
      }
    }
  } finally {
    await doc.destroy();
  }
  return out;
}
