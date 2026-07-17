'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
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

export function LoginForm() {
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
  );
}
