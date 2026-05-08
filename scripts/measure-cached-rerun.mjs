import { performance } from 'node:perf_hooks';

const TARGETS = [
  { code: '14100', city: '横浜市',     pref: '神奈川県' },
  { code: '22100', city: '静岡市',     pref: '静岡県' },
  { code: '22139', city: '浜松市浜名区', pref: '静岡県' },
  { code: '22203', city: '沼津市',     pref: '静岡県' },
  { code: '23201', city: '豊橋市',     pref: '愛知県' },
  { code: '24201', city: '津市',       pref: '三重県' },
  { code: '39201', city: '高知市',     pref: '高知県' },
  { code: '36201', city: '徳島市',     pref: '徳島県' },
  { code: '19202', city: '富士吉田市', pref: '山梨県' },
];
const RUNS = 3;
const BASE = 'http://localhost:3000';

async function measureOnce(code, name, pref) {
  const start = performance.now();
  const url = `${BASE}/api/disasters?code=${code}&name=${encodeURIComponent(name)}&prefecture=${encodeURIComponent(pref)}`;
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status} for ${code}`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    if (buf.includes('event: cache_hit') || buf.includes('"type":"result"')) {
      const elapsed = performance.now() - start;
      await reader.cancel();
      return elapsed;
    }
  }
  throw new Error(`No cache_hit/result event for ${code}`);
}

const out = [];
for (const t of TARGETS) {
  const samples = [];
  for (let i = 0; i < RUNS; i++) {
    try {
      samples.push(await measureOnce(t.code, t.city, t.pref));
    } catch (e) {
      console.error(`  ${t.code} run ${i+1}: ${e.message}`);
    }
  }
  if (samples.length === 0) { out.push({ ...t, mean_ms: null, min_ms: null, max_ms: null }); continue; }
  const mean = samples.reduce((a,b)=>a+b,0) / samples.length;
  const min = Math.min(...samples);
  const max = Math.max(...samples);
  out.push({ ...t, mean_ms: Math.round(mean), min_ms: Math.round(min), max_ms: Math.round(max), samples: samples.map(s => Math.round(s)) });
}

console.log('code  | city            | mean (ms) | min (ms) | max (ms) | samples');
console.log('------+-----------------+-----------+----------+----------+-------------------');
for (const r of out) {
  console.log(`${r.code.padEnd(5)} | ${r.city.padEnd(15)} | ${String(r.mean_ms ?? '?').padStart(9)} | ${String(r.min_ms ?? '?').padStart(8)} | ${String(r.max_ms ?? '?').padStart(8)} | ${r.samples?.join(', ') ?? 'failed'}`);
}

console.log('\n=== JSON ===');
console.log(JSON.stringify(out, null, 2));
