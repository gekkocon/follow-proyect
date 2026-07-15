'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { projectFormSchema, type ProjectFormValues } from '@/src/lib/supabase/project-schema';
import { createProject, updateProject } from '@/src/lib/supabase/project-actions';
import { cn } from '@/lib/utils';
import type { ProjectWithRelations, DbUser } from '@/src/lib/supabase/types';

type Props = {
  mode: 'create' | 'edit';
  project: ProjectWithRelations | null;
  users: DbUser[];
  onSuccess: () => void;
  onCancel: () => void;
};

const STATUS_OPTIONS = [
  { value: 'planning',  label: 'Planificación' },
  { value: 'active',    label: 'Activo' },
  { value: 'on_hold',   label: 'En pausa' },
  { value: 'completed', label: 'Completado' },
  { value: 'overdue',   label: 'Atrasado' },
] as const;

const PRIORITY_OPTIONS = [
  { value: 'low',      label: 'Baja' },
  { value: 'medium',   label: 'Media' },
  { value: 'high',     label: 'Alta' },
  { value: 'critical', label: 'Crítica' },
] as const;

const field =
  'w-full rounded-lg border border-input bg-white px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent disabled:opacity-50';
const label = 'block text-sm font-medium text-foreground mb-1.5';
const errMsg = 'mt-1 text-xs text-red-600';

export function ProjectForm({ mode, project, users, onSuccess, onCancel }: Props) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<ProjectFormValues>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: {
      name:        project?.name                            ?? '',
      description: project?.description                    ?? '',
      status:      project?.status                         ?? 'planning',
      priority:    project?.priority                       ?? 'medium',
      owner_id:    project?.owner_id ? String(project.owner_id) : '',
      start_date:  project?.start_date                     ?? '',
      due_date:    project?.due_date                       ?? '',
    },
  });

  async function onSubmit(values: ProjectFormValues) {
    const result =
      mode === 'create'
        ? await createProject(values)
        : await updateProject(project!.id, values);

    if (result.error) {
      setError('root', { message: result.error });
      return;
    }
    onSuccess();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {errors.root && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <strong>Error:</strong> {errors.root.message}
        </div>
      )}

      {/* Nombre */}
      <div>
        <label className={label}>Nombre del proyecto *</label>
        <input
          {...register('name')}
          placeholder="Ej. Rediseño Dashboard"
          className={field}
          autoFocus
        />
        {errors.name && <p className={errMsg}>{errors.name.message}</p>}
      </div>

      {/* Descripción */}
      <div>
        <label className={label}>Descripción</label>
        <textarea
          {...register('description')}
          placeholder="Descripción breve del proyecto..."
          rows={3}
          className={cn(field, 'resize-none')}
        />
        {errors.description && <p className={errMsg}>{errors.description.message}</p>}
      </div>

      {/* Estado + Prioridad */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={label}>Estado</label>
          <select {...register('status')} className={field}>
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={label}>Prioridad</label>
          <select {...register('priority')} className={field}>
            {PRIORITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Responsable */}
      <div>
        <label className={label}>Responsable principal</label>
        <select {...register('owner_id')} className={field}>
          <option value="">Sin asignar</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
      </div>

      {/* Fechas */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={label}>Fecha inicio</label>
          <input type="date" {...register('start_date')} className={field} />
        </div>
        <div>
          <label className={label}>Fecha tentativa</label>
          <input type="date" {...register('due_date')} className={field} />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting
            ? 'Guardando...'
            : mode === 'create'
            ? 'Crear proyecto'
            : 'Guardar cambios'}
        </button>
      </div>
    </form>
  );
}
