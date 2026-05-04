import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  // ネイティブ binding / CommonJS 寄り依存は webpack バンドルから外し、Node の require に任せる。
  // これで `import.meta.url` / `createRequire` がランタイムの実体パスを返すため、
  // package manager (npm/pnpm/yarn) のレイアウト差異を気にせず deploy 先を問わず動く。
  serverExternalPackages: [
    'pdfjs-dist',
    '@napi-rs/canvas',
    'browser-use',
    'playwright',
  ],
  experimental: {
    serverActions: { bodySizeLimit: '8mb' },
  },
};

export default config;
