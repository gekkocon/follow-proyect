'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Check, Palette } from 'lucide-react';
import { saveBrandSettings } from '@/src/lib/supabase/brand-actions';
import { useBrandStore } from '@/src/store/brandStore';
import type { DbBrandSettings } from '@/src/lib/supabase/brand-actions';

const PRESET_COLORS = [
  { label: 'Azul',    value: '#2563EB' },
  { label: 'Índigo',  value: '#4F46E5' },
  { label: 'Violeta', value: '#7C3AED' },
  { label: 'Rosa',    value: '#DB2777' },
  { label: 'Verde',   value: '#16A34A' },
  { label: 'Naranja', value: '#EA580C' },
  { label: 'Slate',   value: '#475569' },
];

const schema = z.object({
  org_name:      z.string().min(1, 'El nombre de la agencia es requerido').max(100),
  logo_url:      z.string().refine(
    (v) => v === '' || /^https?:\/\/.+/.test(v),
    { message: 'Debe ser una URL válida (https://...)' }
  ),
  favicon_url:   z.string().refine(
    (v) => v === '' || /^https?:\/\/.+/.test(v),
    { message: 'Debe ser una URL válida (https://...)' }
  ),
  primary_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color inválido'),
});

type FormValues = z.infer<typeof schema>;

type Props = {
  initialBrand: DbBrandSettings | null;
};

const labelClass = 'block text-sm font-medium text-foreground mb-1.5';
const inputClass =
  'w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50';

export function SettingsForm({ initialBrand }: Props) {
  const setBrand = useBrandStore((s) => s.setBrand);
  const [saved, setSaved] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      org_name:      initialBrand?.org_name      ?? 'FEMCO',
      logo_url:      initialBrand?.logo_url       ?? '',
      favicon_url:   initialBrand?.favicon_url    ?? '',
      primary_color: initialBrand?.primary_color  ?? '#2563EB',
    },
  });

  const currentColor = watch('primary_color');

  async function onSubmit(values: FormValues) {
    setSaved(false);
    const result = await saveBrandSettings(values, initialBrand?.id);
    if (result.error) {
      setError('root', { message: result.error });
      return;
    }

    // Update Zustand so Sidebar / tab title / favicon reflect immediately
    setBrand({
      orgName:      values.org_name,
      logoUrl:      values.logo_url || null,
      faviconUrl:   values.favicon_url || null,
      primaryColor: values.primary_color,
    });

    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 max-w-xl">

      {/* ── Identidad ───────────────────────────────────────────────────────── */}
      <section className="rounded-xl border border-border bg-white p-6 space-y-5 shadow-sm">
        <h2 className="text-sm font-semibold text-foreground">Identidad de la agencia</h2>

        {/* Nombre */}
        <div>
          <label className={labelClass}>Nombre de la agencia</label>
          <input
            {...register('org_name')}
            placeholder="Ej. FEMCO"
            className={inputClass}
            disabled={isSubmitting}
          />
          {errors.org_name && (
            <p className="mt-1 text-xs text-red-600">{errors.org_name.message}</p>
          )}
        </div>

        {/* Logo URL */}
        <div>
          <label className={labelClass}>URL del logo <span className="text-muted-foreground font-normal">(opcional)</span></label>
          <input
            {...register('logo_url')}
            type="url"
            placeholder="https://ejemplo.com/logo.png"
            className={inputClass}
            disabled={isSubmitting}
          />
          {errors.logo_url && (
            <p className="mt-1 text-xs text-red-600">{errors.logo_url.message}</p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            URL pública de imagen. Subida de archivos — fase posterior.
          </p>
        </div>

        {/* Favicon URL */}
        <div>
          <label className={labelClass}>URL del favicon <span className="text-muted-foreground font-normal">(opcional)</span></label>
          <div className="flex items-center gap-3">
            {watch('favicon_url') && /^https?:\/\/.+/.test(watch('favicon_url')) && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={watch('favicon_url')}
                alt="Favicon preview"
                className="h-8 w-8 rounded border border-border object-contain shrink-0"
              />
            )}
            <input
              {...register('favicon_url')}
              type="url"
              placeholder="https://ejemplo.com/favicon.png"
              className={inputClass}
              disabled={isSubmitting}
            />
          </div>
          {errors.favicon_url && (
            <p className="mt-1 text-xs text-red-600">{errors.favicon_url.message}</p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            Se usa como ícono de la pestaña del navegador. Recomendado: imagen cuadrada (PNG/ICO/SVG).
          </p>
        </div>
      </section>

      {/* ── Color primario ──────────────────────────────────────────────────── */}
      <section className="rounded-xl border border-border bg-white p-6 space-y-5 shadow-sm">
        <div className="flex items-center gap-2">
          <Palette size={15} className="text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Color de marca</h2>
        </div>

        {/* Preset swatches */}
        <div>
          <label className={labelClass}>Colores predefinidos</label>
          <div className="flex flex-wrap gap-2">
            {PRESET_COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                title={c.label}
                onClick={() => setValue('primary_color', c.value, { shouldDirty: true })}
                className="relative h-8 w-8 rounded-full border-2 transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
                style={{
                  backgroundColor: c.value,
                  borderColor: currentColor === c.value ? c.value : 'transparent',
                }}
              >
                {currentColor === c.value && (
                  <Check size={14} className="absolute inset-0 m-auto text-white" strokeWidth={3} />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Custom hex + color input */}
        <div>
          <label className={labelClass}>Color personalizado (hex)</label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={currentColor}
              onChange={(e) => setValue('primary_color', e.target.value, { shouldDirty: true })}
              disabled={isSubmitting}
              className="h-9 w-12 cursor-pointer rounded-lg border border-border p-0.5 disabled:opacity-50"
            />
            <input
              {...register('primary_color')}
              placeholder="#2563EB"
              className={inputClass + ' font-mono uppercase'}
              disabled={isSubmitting}
              maxLength={7}
            />
          </div>
          {errors.primary_color && (
            <p className="mt-1 text-xs text-red-600">{errors.primary_color.message}</p>
          )}
        </div>

        {/* Preview strip */}
        <div
          className="h-3 w-full rounded-full transition-colors duration-300"
          style={{ backgroundColor: /^#[0-9A-Fa-f]{6}$/.test(currentColor) ? currentColor : '#2563EB' }}
        />
      </section>

      {/* ── Actions ─────────────────────────────────────────────────────────── */}
      {errors.root && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errors.root.message}
        </div>
      )}

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={isSubmitting || !isDirty}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {isSubmitting && <Loader2 size={14} className="animate-spin" />}
          Guardar cambios
        </button>

        {saved && (
          <span className="inline-flex items-center gap-1.5 text-sm text-green-600 font-medium">
            <Check size={15} strokeWidth={2.5} />
            Cambios guardados
          </span>
        )}
      </div>
    </form>
  );
}
