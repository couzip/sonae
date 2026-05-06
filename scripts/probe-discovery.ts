import { SonaeDiscoverer } from '../src/lib/sonae/discoverer';
import { getLlm } from '../src/lib/sonae/llmRoles';
import type { PipelineContext } from '../src/lib/core';
import type { SonaeQuery } from '../src/lib/sonae/types';

async function probeOne(code: string, name: string, prefecture: string) {
  const d = new SonaeDiscoverer({
    llm: getLlm('discovery'),
    headless: false,
  });
  const ctx: PipelineContext<SonaeQuery> = {
    query: { municipality_code: code, city_name: name, prefecture },
    emit: (e: any) => {
      if (e.type === 'log') console.log(`  [log] ${e.message}`);
      else if (e.type === 'phase') console.log(`  [${e.status}] ${e.message}`);
    },
  };
  console.log(`\n=== ${prefecture} ${name} (${code}) ===`);
  const t0 = Date.now();
  try {
    const result = await d.discover({ municipality_code: code, city_name: name, prefecture }, ctx);
    console.log(`  ✓ picked: ${result.pdf_label}`);
    console.log(`    url: ${result.pdf_url}`);
    console.log(`    ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  } catch (e: any) {
    console.log(`  ✗ failed: ${e?.message ?? e}`);
  }
}

async function main() {
  const cases = [
    { code: '23231', name: '田原市', prefecture: '愛知県' },
    { code: '24210', name: '亀山市', prefecture: '三重県' },
    { code: '24205', name: '桑名市', prefecture: '三重県' },
    { code: '36202', name: '鳴門市', prefecture: '徳島県' },
  ];
  for (const c of cases) {
    await probeOne(c.code, c.name, c.prefecture);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
