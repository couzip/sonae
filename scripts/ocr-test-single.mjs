import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const LMS = 'C:\\Users\\Hayshida\\.lmstudio\\bin\\lms.exe';
const LM_STUDIO_URL = 'http://localhost:1234';
const model = process.argv[2];
const TEST_IMAGE = process.argv[3] || 'cache/work/22220_c0132ab7c973_1778129643476/target_pages/page_0016.png';
if (!model) {
  console.error('usage: node ocr-test-single.mjs <model> [image-path]');
  process.exit(1);
}

const OCR_PROMPT =
  'この日本語のページをMarkdownで書き起こしてください。' +
  '見出しは # / ## / ### を使い、箇条書きは - を使う。' +
  '図・表は [図: 簡潔な説明] と書いてください。' +
  'ページ番号やヘッダー/フッターは無視。本文を一字一句正確に。';

function lms(...args) {
  try { return execFileSync(LMS, args, { encoding: 'utf-8', stdio: 'pipe' }); }
  catch (e) { return `(lms error: ${e.message})`; }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const imageB64 = readFileSync(TEST_IMAGE).toString('base64');

  console.log(`unload all...`);
  lms('unload', '--all');
  await sleep(2000);

  console.log(`loading ${model}...`);
  const loadStart = Date.now();
  const loadOut = lms('load', model, '-y');
  const loadMs = Date.now() - loadStart;
  console.log(`load done in ${loadMs}ms`);
  console.log(`waiting 5s for warmup...`);
  await sleep(5000);

  console.log(`calling OCR...`);
  const body = {
    model,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: OCR_PROMPT },
          { type: 'image_url', image_url: { url: `data:image/png;base64,${imageB64}` } },
        ],
      },
    ],
    temperature: 0,
    max_tokens: 8192,
  };
  const start = Date.now();
  const res = await fetch(`${LM_STUDIO_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(300000),
  });
  const elapsedMs = Date.now() - start;
  const text = await res.text();
  if (!res.ok) {
    console.log(`OCR failed: HTTP ${res.status}, ${text.slice(0, 500)}`);
    process.exit(2);
  }
  const data = JSON.parse(text);
  const content = data?.choices?.[0]?.message?.content ?? '';
  const finishReason = data?.choices?.[0]?.finish_reason ?? '';
  const usage = data?.usage ?? {};
  console.log(`done in ${elapsedMs}ms, ${content.length} chars, finish=${finishReason}`);

  const safe = model.replace(/[\\/@:]/g, '_');
  const outPath = `scripts/ocr-comparison/${safe}.md`;
  writeFileSync(outPath, content);
  console.log(`wrote ${outPath}`);

  lms('unload', '--all');
  console.log(`\n=== content ===\n${content}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
