import Link from 'next/link';
import { HUDFrame, HairlineDivider } from '@/components/cockpit';
import { BuildingForm } from '@/components/profile/BuildingForm';
import { HouseholdForm } from '@/components/profile/HouseholdForm';
import { LifestyleForm } from '@/components/profile/LifestyleForm';

export const metadata = { title: 'Sonae — プロファイル' };

export default function SettingsPage() {
  return (
    <main className="min-h-screen bg-bg p-4">
      <HUDFrame
        title="プロファイル"
        rightSlot={
          <Link
            href="/"
            className="border-hairline border-hairline px-3 py-1 rounded-cockpit hover:border-accent transition-colors text-xs text-ink-mute"
          >
            戻る
          </Link>
        }
        className="max-w-5xl mx-auto"
        bodyClassName="p-6"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <section className="md:col-span-3">
            <p className="text-xs text-ink-mute leading-relaxed">
              入力した情報はお使いの端末にだけ保存され、サーバーには送信されません。
              「次の活動方針」を生成するときだけ、LLM への入力として利用されます。
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
