import { fetchBrandSettings } from '@/src/lib/supabase/brand-actions';
import { brand as staticBrand } from '@/src/lib/config/brand';
import { LoginForm } from '@/components/login/LoginForm';

export default async function LoginPage() {
  const { brand } = await fetchBrandSettings();

  const orgName      = brand?.org_name      ?? staticBrand.agency_name;
  const logoUrl       = brand?.logo_url      ?? staticBrand.logo_url;
  const primaryColor  = brand?.primary_color ?? staticBrand.primary_color;

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-white p-8 shadow-sm">

        {/* Logo / Brand */}
        <div className="mb-8 flex flex-col items-center gap-2">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={orgName} className="h-12 w-auto" />
          ) : (
            <span
              className="flex h-12 w-12 items-center justify-center rounded-xl text-xl font-bold text-white"
              style={{ backgroundColor: primaryColor }}
            >
              {orgName.charAt(0)}
            </span>
          )}
          <h1 className="text-xl font-semibold text-foreground">{orgName}</h1>
          <p className="text-sm text-muted-foreground">Inicia sesión para continuar</p>
        </div>

        <LoginForm />
      </div>
    </div>
  );
}
