import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';

const CACHE = path.resolve('cache');

const TARGETS = [
  { code: '14100', city: '横浜市', pref: '神奈川', note: '相模トラフ' },
  { code: '22100', city: '静岡市', pref: '静岡', note: '駿河湾・南海トラフ' },
  { code: '22139', city: '浜松市浜名区', pref: '静岡', note: '南海トラフ・政令指定都市の区' },
  { code: '22203', city: '沼津市', pref: '静岡', note: '駿河湾沿岸' },
  { code: '23201', city: '豊橋市', pref: '愛知', note: '伊勢湾・南海トラフ' },
  { code: '24201', city: '津市', pref: '三重', note: '伊勢湾・南海トラフ' },
  { code: '39201', city: '高知市', pref: '高知', note: '南海トラフ直撃' },
  { code: '36201', city: '徳島市', pref: '徳島', note: '南海トラフ' },
  { code: '19202', city: '富士吉田市', pref: '山梨', note: '唯一の mixed PDF 例' },
];

function load(p) {
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; }
}

const rows = TARGETS.map(({ code, city, pref, note }) => {
  const muni = load(path.join(CACHE, 'municipalities', `${code}.json`));
  const ocrMeta = load(path.join(CACHE, 'ocr', `${code}.meta.json`));
  const pdfMeta = load(path.join(CACHE, 'pdfs', `${code}.meta.json`));
  const pdfPath = path.join(CACHE, 'pdfs', `${code}.pdf`);
  const ocrMdPath = path.join(CACHE, 'ocr', `${code}.md`);
  const muniPath = path.join(CACHE, 'municipalities', `${code}.json`);

  const pdfBytes = existsSync(pdfPath) ? statSync(pdfPath).size : null;
  const ocrChars = existsSync(ocrMdPath) ? readFileSync(ocrMdPath, 'utf8').length : null;

  const downloadedAt = pdfMeta?.downloaded_at ? new Date(pdfMeta.downloaded_at).getTime() : null;
  const completedAt = existsSync(muniPath) ? statSync(muniPath).mtimeMs : null;
  const firstRunMs = downloadedAt && completedAt ? Math.max(0, completedAt - downloadedAt) : null;

  const dt = (muni?.by_disaster_type ?? []).map((d) => d.disaster_type);
  const secPages = ocrMeta?.section?.page_count ?? null;
  const scannedPages = ocrMeta?.scanned_pages?.length ?? 0;
  const pdfType = scannedPages === 0 && secPages > 0 ? 'text' : scannedPages >= (secPages ?? 0) && (secPages ?? 0) > 0 ? 'scanned' : scannedPages > 0 ? 'mixed' : 'unknown';

  return {
    code, city, pref, note,
    pdf_kb: pdfBytes ? Math.round(pdfBytes / 1024) : null,
    section_title: ocrMeta?.section?.title ?? '',
    section_pages: secPages,
    scanned_pages: scannedPages,
    pdf_type: pdfType,
    ocr_chars: ocrChars,
    disaster_count: dt.length,
    disaster_types: dt,
    first_run_seconds: firstRunMs ? Math.round(firstRunMs / 1000) : null,
  };
});

console.log('=== 9 self-selected target municipalities ===');
console.log('code  | city            | pref     | type    | sec p | OCR chars | dt | est. 1st run');
console.log('------+-----------------+----------+---------+-------+-----------+----+--------------');
for (const r of rows) {
  console.log(
    `${r.code.padEnd(5)} | ${r.city.padEnd(15)} | ${r.pref.padEnd(8)} | ${r.pdf_type.padEnd(7)} | ${String(r.section_pages ?? '?').padStart(5)} | ${String(r.ocr_chars ?? '?').padStart(9)} | ${String(r.disaster_count).padStart(2)} | ${r.first_run_seconds !== null ? `~${r.first_run_seconds}s` : '?'}`,
  );
}

console.log('\n=== JSON for downstream ===');
console.log(JSON.stringify(rows, null, 2));
