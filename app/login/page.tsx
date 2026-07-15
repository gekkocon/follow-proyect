'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { brand } from '@/src/lib/config/brand';
import { createClient } from '@/src/lib/supabase/client';
import { useAuthStore } from '@/src/store/authStore';

const schema = z.object({
  email:    z.string().min(1, 'El email es requerido').email('Email inválido'),
  password: z.string().min(1, 'La contraseña es requerida'),
});

type FormValues = z.infer<typeof schema>;

const inputClass =
  'w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-foreground ' +
  'placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring ' +
  'disabled:opacity-50';

export default function LoginPage() {
  const router   = useRouter();
  const setUser  = useAuthStore((s) => s.setUser);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    setServerError(null);
    const supabase = createClient();

    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({
        email:    values.email.trim().toLowerCase(),
        password: values.password,
      });

    if (authError) {
      setServerError('Credenciales incorrectas. Verifica tu email y contraseña.');
      return;
    }

    // Look up user record in the `users` table by email
    const { data: dbUser, error: dbError } = await supabase
      .from('users')
      .select('id, name, email, role')
      .eq('email', authData.user?.email ?? '')
      .single();

    if (dbError || !dbUser) {
      setServerError('Tu cuenta de acceso no está registrada en el sistema. Contacta al administrador.');
      await supabase.auth.signOut();
      return;
    }

    setUser({ id: dbUser.id, name: dbUser.name, email: dbUser.email, role: dbUser.role });
    router.push('/dashboard');
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-white p-8 shadow-sm">

        {/* Logo / Brand */}
        <div className="mb-8 flex flex-col items-center gap-2">
          <span
            className="flex h-12 w-12 items-center justify-center rounded-xl text-xl font-bold text-white"
            style={{ backgroundColor: brand.primary_color }}
          >
            {brand.agency_name.charAt(0)}
          </span>
          <h1 className="text-xl font-semibold text-foreground">{brand.agency_name}</h1>
          <p className="text-sm text-muted-foreground">Inicia sesión para continuar</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Email */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              Email
            </label>
            <input
              {...register('email')}
              type="email"
              placeholder="usuario@empresa.com"
              className={inputClass}
              disabled={isSubmitting}
              autoComplete="email"
            />
            {errors.email && (
              <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>
            )}
          </div>

          {/* Contraseña */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              Contraseña
            </label>
            <input
              {...register('password')}
              type="password"
              placeholder="••••••••"
              className={inputClass}
              disabled={isSubmitting}
              autoComplete="current-password"
            />
            {errors.password && (
              <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>
            )}
          </div>

          {/* Server error */}
          {serverError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
              {serverError}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
          >
            {isSubmitting && <Loader2 size={14} className="animate-spin" />}
            Iniciar sesión
          </button>
        </form>
      </div>
    </div>
  );
}
