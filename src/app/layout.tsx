import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Sonae — 事前の備えを、コックピットで。',
  description:
    '災害が起きる前に動く防災コックピット。自治体の地域防災計画から想定災害を解析し、個別最適化された備え方針を提示します。',
  applicationName: 'Sonae',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className="dark">
      <body className="scanline min-h-screen">{children}</body>
    </html>
  );
}
