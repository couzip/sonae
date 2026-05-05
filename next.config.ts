import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  // ネイティブ binding / CommonJS 寄り依存は webpack バンドルから外し、Node の require に任せる。
  // これで `import.meta.url` / `createRequire` がランタイムの実体パスを返すため、
  // package manager (npm/pnpm/yarn) のレイアウト差異を気にせず deploy 先を問わず動く。
  serverExternalPackages: [
    'pdfjs-dist',
    '@napi-rs/canvas',
    'playwright',
    'rebrowser-playwright',
  ],
  experimental: {
    serverActions: { bodySizeLimit: '8mb' },
    // Server Component は dynamic="force-dynamic" で毎回再評価されるが、
    // クライアントの router cache が前回 render を保持し続けるため、
    // 戻る/別画面遷移で stale な内容が出る。dynamic ルートのキャッシュは
    // 持たない設定にして、毎回 fresh な server render を取得する。
    staleTimes: { dynamic: 0, static: 30 },
  },
};

export default config;
