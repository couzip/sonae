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

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

/**
 * Resolve `pdfjs-dist`'s on-disk root.
 *
 * `createRequire(import.meta.url)` does not work here in Next.js: the bundler
 * rewrites `import.meta.url` to a virtual `(rsc)/...` path that doesn't exist
 * on disk, so `pdfjs` then tries to load `cmaps/...` and `standard_fonts/...`
 * from a non-existent location and emits "Unable to load font data" warnings.
 *
 * `process.cwd()` is the project root for `next dev` / `next start` / Vercel /
 * Docker (when WORKDIR is the project root) — i.e. every environment Next.js
 * actually targets.
 */
function resolvePdfjsRoot(): string {
  // Path 1: top-level dependency (what `npm install pdfjs-dist` gives you).
  const direct = join(process.cwd(), 'node_modules', 'pdfjs-dist');
  if (existsSync(join(direct, 'package.json'))) return direct;
  // Path 2: pnpm or yarn-pnp shape (rare here, but cheap to try).
  const pnpm = join(process.cwd(), 'node_modules', '.pnpm');
  if (existsSync(pnpm)) {
    // We don't try to enumerate pnpm hashes here. If you hit this, install
    // pdfjs-dist as a top-level dependency in your fork.
  }
  throw new Error(
    `pdfjs-dist not found at ${direct}. Install it as a top-level dependency.`,
  );
}

const _pdfjsRoot = resolvePdfjsRoot();
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
 * @param scale viewport scale factor; 1.5 ≈ 120 dpi.
 */
export async function renderPages(
  pdfPath: string,
  outputAbsDir: string,
  pageNums: number[],
  scale = 1.5,
): Promise<RenderedPage[]> {
  mkdirSync(outputAbsDir, { recursive: true });
  const doc = await loadDocument(pdfPath);

  // pdfjs-dist の Node 環境用 canvasFactory は doc に紐付いて公開されるが、公式型に
  // 含まれていないので、利用するメソッドだけを宣言した最小インターフェースで取り出す。
  interface CanvasContext {
    canvas: { toBuffer: (mime: string) => Buffer };
    context: unknown;
  }
  interface CanvasFactory {
    create: (width: number, height: number) => CanvasContext;
    destroy: (cc: CanvasContext) => void;
  }
  const factory = (doc as unknown as { canvasFactory?: CanvasFactory }).canvasFactory;
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
          canvasContext: cc.context as Parameters<typeof page.render>[0]['canvasContext'],
          viewport,
          canvas: cc.canvas as unknown as Parameters<typeof page.render>[0]['canvas'],
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
