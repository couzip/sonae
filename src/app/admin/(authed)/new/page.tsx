import { RegisterMunicipalityForm } from '@/components/admin/RegisterMunicipalityForm';

export const dynamic = 'force-dynamic';

export default async function NewMunicipalityPage() {
  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <h1 className="font-sans text-2xl text-ink">市/区を新規登録</h1>
      <RegisterMunicipalityForm />
    </div>
  );
}
