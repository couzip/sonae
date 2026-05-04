#!/usr/bin/env tsx
/**
 * CLI entrypoint for the news-summarizer example.
 *
 *   npx tsx examples/news-summarizer/run.ts <url>
 */

import { summariseNews } from './pipeline';

async function main() {
  const url = process.argv[2];
  if (!url) {
    console.error('usage: tsx examples/news-summarizer/run.ts <url>');
    process.exit(1);
  }

  const result = await summariseNews(url, (event) => {
    if (event.type === 'phase' || event.type === 'log' || event.type === 'cache_hit') {
      // eslint-disable-next-line no-console
      console.log(`[${event.type}]`, JSON.stringify(event));
    }
    if (event.type === 'error') {
      console.error('[error]', event.message);
    }
  });

  // eslint-disable-next-line no-console
  console.log('\n=== RESULT ===\n' + JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
