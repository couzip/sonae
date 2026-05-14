import { execFileSync, spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const LMS = 'C:\\Users\\Hayshida\\.lmstudio\\bin\\lms.exe';
const LM_STUDIO_URL = 'http://localhost:1234';
const TEST_IMAGE = 'cache/work/22220_c0132ab7c973_1778129643476/target_pages/page_0016.png';

const MODELS = [
  'dots.mocr@iq3_xxs',
  'dots.mocr@iq4_nl',
  'lodrick-the-lafted/dots.mocr',
  'mradermacher/chandra-ocr-2',
  'prithivmlmods/chandra-ocr-2',
  'mineru2.5-pro-2604-1.2b-i1',
  'lightonocr-2-1b-ocr-soup',
  'glm-ocr@f16',
  'glm-ocr@q8_0',
  'paddlepaddle/paddleocr-vl-1.5-gguf/paddleocr-vl-1.5.gguf',
];

const OCR_PROMPT =
  'この日本語のページをMarkdownで書き起こしてください。' +
  '見出しは # / ## / ### を使い、箇条書きは - を使う。' +
  '図・表は [図: 簡潔な説明] と書いてください。' +
  'ページ番号やヘッダー/フッターは無視。本文を一字一句正確に。';

function lms(...args) {
  try {
    return execFileSync(LMS, args, { encoding: 'utf-8', stdio: 'pipe' });
  } catch (e) {
    return `(lms error: ${e.message})`;
  }
}

async function waitLoaded(model, timeoutMs = 180000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const ps = lms('ps');
    if (ps.includes(model.split('/').pop().replace(/@.*/, ''))) return true;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

async function callOcr(model, imageB64) {
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
    return { ok: false, elapsedMs, http: res.status, error: text.slice(0, 500) };
  }
  let data;
  try { data = JSON.parse(text); } catch (e) {
    return { ok: false, elapsedMs, http: res.status, error: 'invalid JSON' };
  }
  const content = data?.choices?.[0]?.message?.content ?? '';
  const finishReason = data?.choices?.[0]?.finish_reason ?? '';
  const usage = data?.usage ?? {};
  return { ok: true, elapsedMs, http: res.status, content, finishReason, usage };
}

function analyze(content) {
  return {
    chars: content.length,
    bytes: Buffer.byteLength(content, 'utf-8'),
    has_html_table: /<table\b/i.test(content),
    has_html_tr: /<tr\b/i.test(content),
    has_html_td: /<(td|th)\b/i.test(content),
    has_html_any: /<[a-z][^>]*>/i.test(content),
    md_headings: (content.match(/^#{1,6}\s/gm) || []).length,
    md_bullets: (content.match(/^\s*[-*]\s/gm) || []).length,
    md_table_rows: (content.match(/^\s*\|/gm) || []).length,
  };
}

async function main() {
  const imgPath = path.resolve(TEST_IMAGE);
  const imageB64 = readFileSync(imgPath).toString('base64');
  console.log(`test image: ${imgPath}`);
  console.log(`image size: ${(readFileSync(imgPath).length / 1024).toFixed(1)} KB\n`);

  const results = [];

  for (const model of MODELS) {
    console.log(`\n=== ${model} ===`);
    lms('unload', '--all');
    await new Promise((r) => setTimeout(r, 1000));

    console.log('  loading...');
    const loadStart = Date.now();
    const loadOut = lms('load', model);
    const loadMs = Date.now() - loadStart;
    console.log(`  load done in ${loadMs}ms`);

    if (loadOut.includes('error') || loadOut.includes('not found')) {
      console.log(`  SKIP: load failed: ${loadOut.slice(0, 200)}`);
      results.push({ model, status: 'load_failed', error: loadOut.slice(0, 200) });
      continue;
    }

    try {
      const r = await callOcr(model, imageB64);
      if (!r.ok) {
        console.log(`  OCR failed: HTTP ${r.http}, ${r.error}`);
        results.push({ model, status: 'ocr_failed', loadMs, ...r });
      } else {
        const a = analyze(r.content);
        console.log(`  OCR done in ${r.elapsedMs}ms, ${a.chars} chars, html_table=${a.has_html_table}, finish=${r.finishReason}`);
        results.push({
          model,
          status: 'ok',
          loadMs,
          ocrMs: r.elapsedMs,
          finish_reason: r.finishReason,
          usage: r.usage,
          analysis: a,
          content: r.content,
        });
      }
    } catch (e) {
      console.log(`  exception: ${e.message}`);
      results.push({ model, status: 'exception', error: e.message });
    }

    lms('unload', '--all');
    await new Promise((r) => setTimeout(r, 1000));
  }

  writeFileSync('scripts/ocr-benchmark-result.json', JSON.stringify(results, null, 2));
  console.log('\n=== summary table ===');
  console.log('| model | load (ms) | OCR (ms) | chars | HTML? | finish | comp tokens |');
  console.log('|---|---:|---:|---:|---|---|---:|');
  for (const r of results) {
    if (r.status === 'ok') {
      const a = r.analysis;
      console.log(
        `| ${r.model} | ${r.loadMs} | ${r.ocrMs} | ${a.chars} | ${a.has_html_table ? 'table' : a.has_html_any ? 'tags' : 'no'} | ${r.finish_reason} | ${r.usage?.completion_tokens ?? '?'} |`,
      );
    } else {
      console.log(`| ${r.model} | - | - | - | - | ${r.status} | - |`);
    }
  }
  console.log('\nFull results saved to scripts/ocr-benchmark-result.json');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
