import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Sonae — その日の前にしか、できないことがある。',
  description:
    '災害が起きる前に動く事前防災ツール。自治体が既に公開している地域防災計画から想定災害を解析し、あなたの建物・世帯にあわせた備え方針を提示します。',
  applicationName: 'Sonae',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className="dark">
      <body className="scanline min-h-screen">{children}</body>
    </html>
  );
}
