import { fetchBrandSettings } from '@/src/lib/supabase/brand-actions';
import { SettingsForm } from '@/components/settings/SettingsForm';

export default async function SettingsPage() {
  const { brand, error } = await fetchBrandSettings();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Configuración</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Ajustes de identidad y marca de la agencia.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <strong>Error al cargar configuración:</strong> {error}
        </div>
      )}

      <SettingsForm initialBrand={brand} />
    </div>
  );
}
