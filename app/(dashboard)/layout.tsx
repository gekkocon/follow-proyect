import { AppLayout } from '@/components/layout/AppLayout';
import { AuthHydrator } from '@/components/layout/AuthHydrator';
import { fetchBrandSettings } from '@/src/lib/supabase/brand-actions';
import { getSessionUser } from '@/src/lib/supabase/auth';

export default async function DashboardGroupLayout({ children }: { children: React.ReactNode }) {
  const [{ brand }, sessionUser] = await Promise.all([
    fetchBrandSettings(),
    getSessionUser(),
  ]);

  return (
    <>
      <AuthHydrator user={sessionUser} />
      <AppLayout initialBrand={brand}>{children}</AppLayout>
    </>
  );
}
