'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { USER_ROLE_LABELS, USER_STATUS_LABELS } from '@/src/lib/constants';
import { createUser, updateUser } from '@/src/lib/supabase/user-actions';
import type { DbUser } from '@/src/lib/supabase/types';

const baseSchema = z.object({
  name:   z.string().min(1, 'El nombre es requerido').max(100),
  email:  z.string().min(1, 'El email es requerido').email('Email inválido'),
  role:   z.enum(['admin', 'pm', 'developer', 'designer'] as const),
  status: z.enum(['active', 'inactive'] as const),
  password: z.string().optional(),
});

const createSchema = baseSchema.extend({
  password: z.string().min(8, 'Mínimo 8 caracteres'),
});

const editSchema = baseSchema.extend({
  password: z.string().refine((v) => !v || v.length >= 8, {
    message: 'Mínimo 8 caracteres si cambias la contraseña',
  }).optional(),
});

type FormValues = z.infer<typeof baseSchema>;

type Props = {
  user?: DbUser;
  onSuccess: () => void;
  onCancel: () => void;
};

const labelClass = 'block text-sm font-medium text-foreground mb-1.5';
const inputClass =
  'w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50';
const selectClass = inputClass + ' cursor-pointer';

export function UserForm({ user, onSuccess, onCancel }: Props) {
  const isEditing = !!user;

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(isEditing ? editSchema : createSchema),
    defaultValues: {
      name:     user?.name   ?? '',
      email:    user?.email  ?? '',
      role:     user?.role   ?? 'developer',
      status:   user?.status ?? 'active',
      password: '',
    },
  });

  async function onSubmit(values: FormValues) {
    const result = isEditing
      ? await updateUser(user.id, values)
      : await createUser(values);

    if (result.error) {
      setError('root', { message: result.error });
      return;
    }
    onSuccess();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* Nombre */}
      <div>
        <label className={labelClass}>Nombre completo</label>
        <input
          {...register('name')}
          placeholder="Ej. Ana Torres"
          className={inputClass}
          disabled={isSubmitting}
        />
        {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
      </div>

      {/* Email */}
      <div>
        <label className={labelClass}>Email</label>
        <input
          {...register('email')}
          type="email"
          placeholder="ana@femco.com"
          className={inputClass}
          disabled={isSubmitting}
        />
        {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
      </div>

      {/* Contraseña */}
      <div>
        <label className={labelClass}>
          Contraseña{isEditing && <span className="ml-1 text-muted-foreground font-normal">(dejar vacío para no cambiar)</span>}
        </label>
        <input
          {...register('password')}
          type="password"
          placeholder={isEditing ? 'Nueva contraseña (opcional)' : 'Mínimo 8 caracteres'}
          className={inputClass}
          disabled={isSubmitting}
          autoComplete="new-password"
        />
        {errors.password && (
          <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>
        )}
      </div>

      {/* Rol */}
      <div>
        <label className={labelClass}>Rol</label>
        <select {...register('role')} className={selectClass} disabled={isSubmitting}>
          {(Object.entries(USER_ROLE_LABELS) as [DbUser['role'], string][]).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        {errors.role && <p className="mt-1 text-xs text-red-600">{errors.role.message}</p>}
      </div>

      {/* Estado */}
      <div>
        <label className={labelClass}>Estado</label>
        <select {...register('status')} className={selectClass} disabled={isSubmitting}>
          {(Object.entries(USER_STATUS_LABELS) as [DbUser['status'], string][]).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </div>

      {/* Root error */}
      {errors.root && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {errors.root.message}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
        >
          {isSubmitting && <Loader2 size={14} className="animate-spin" />}
          {isEditing ? 'Guardar cambios' : 'Crear usuario'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
