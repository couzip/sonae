import type { ReactNode } from 'react';

export const metadata = {
  title: 'Sonae 管理画面',
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
