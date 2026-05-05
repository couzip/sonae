import { LoginForm } from '@/components/admin/LoginForm';
import { Shield } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<{ next?: string }>;
}

export default async function AdminLoginPage({ searchParams }: Props) {
  const sp = await searchParams;
  const next = sp.next ?? '/admin';
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm flex flex-col gap-6">
        <header className="flex flex-col items-center gap-2">
          <div className="h-12 w-12 rounded-cockpit border-hairline border-hairline flex items-center justify-center text-accent bg-accent-soft">
            <Shield className="h-6 w-6" strokeWidth={1.5} aria-hidden />
          </div>
          <h1 className="font-sans text-lg text-ink">Sonae 管理画面</h1>
          <p className="text-xs text-ink-mute">ログインしてください</p>
        </header>
        <LoginForm next={next} />
      </div>
    </div>
  );
}
