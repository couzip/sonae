import { homedir } from 'node:os';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { chromium } from 'rebrowser-playwright';

async function main() {
  const query = '愛知県田原市 地域防災計画 -filetype:pdf -filetype:doc -filetype:docx';
  const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;

  const profileDir = join(homedir(), '.config', 'sonae-discovery', 'chromium-profile');
  mkdirSync(profileDir, { recursive: true });
  const ctx = await chromium.launchPersistentContext(profileDir, {
    channel: 'chrome',
    headless: false,
    viewport: null,
    locale: 'ja-JP',
    args: ['--disable-blink-features=AutomationControlled'],
    ignoreDefaultArgs: ['--enable-automation'],
  });
  await ctx.addInitScript(() => {
    const proto = Object.getPrototypeOf(navigator) as Record<string, unknown>;
    delete proto.webdriver;
  });

  try {
    const page = await ctx.newPage();
    let firstHeaders: Record<string, string> | null = null;
    page.on('request', (req) => {
      if (firstHeaders) return;
      if (req.resourceType() !== 'document') return;
      firstHeaders = req.headers();
    });

    console.log('[probe] goto...', url);
    const t0 = Date.now();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    console.log('[probe] dom ready in', Date.now() - t0, 'ms');
    console.log('[probe] current url:', page.url());
    console.log('[probe] title:', await page.title());

    for (const sel of ['h3', 'div.g', '.yuRUbf', '.tF2Cxc', 'a[href]', 'form#captcha-form']) {
      const n = await page.$$eval(sel, (els) => els.length).catch(() => -1);
      console.log(`[probe] ${sel}: ${n}`);
    }
    try {
      await page.waitForSelector('h3', { timeout: 10_000 });
      console.log('[probe] h3 visible');
    } catch (e: any) {
      console.log('[probe] h3 wait failed:', e?.message);
    }
    for (const sel of ['h3']) {
      const n = await page.$$eval(sel, (els) => els.length).catch(() => -1);
      console.log(`[probe-after-wait] ${sel}: ${n}`);
    }

    console.log('[probe] first document request headers:', JSON.stringify(firstHeaders, null, 2));
  } finally {
    await ctx.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
