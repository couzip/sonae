import Link from 'next/link';
import { HUDFrame, MonoLabel, HairlineDivider } from '@/components/cockpit';
import { BuildingForm } from '@/components/profile/BuildingForm';
import { HouseholdForm } from '@/components/profile/HouseholdForm';
import { LifestyleForm } from '@/components/profile/LifestyleForm';

export const metadata = { title: 'Sonae — プロファイル設定' };

export default function SettingsPage() {
  return (
    <main className="min-h-screen bg-bg p-4">
      <HUDFrame
        serial="SONAE / SETTINGS"
        title="プロファイル"
        rightSlot={
          <Link
            href="/"
            className="border-hairline border-hairline px-3 py-1 rounded-cockpit hover:border-accent transition-colors"
          >
            <MonoLabel size="2xs" tone="default">
              ◀ コックピットへ戻る
            </MonoLabel>
          </Link>
        }
        className="max-w-5xl mx-auto"
        bodyClassName="p-6"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <section className="md:col-span-3">
            <p className="font-sans text-xs text-ink-mute leading-relaxed">
              この情報はあなたの端末 (localStorage) にのみ保存され、サーバーに送信されません。
              <br />
              「次の活動方針」を生成する時のみ、リクエストの一部として LLM に渡されます。
            </p>
          </section>

          <HairlineDivider variant="dashed" className="md:col-span-3" />

          <section className="border-hairline border-hairline rounded-cockpit p-4">
            <BuildingForm />
          </section>

          <section className="border-hairline border-hairline rounded-cockpit p-4">
            <HouseholdForm />
          </section>

          <section className="border-hairline border-hairline rounded-cockpit p-4">
            <LifestyleForm />
          </section>
        </div>
      </HUDFrame>
    </main>
  );
}
