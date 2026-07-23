import type { DbTask, DbSubtask } from '@/src/lib/supabase/types';

export const TASK_STATUSES: { value: DbTask['status']; label: string }[] = [
  { value: 'todo', label: 'Por hacer' },
  { value: 'in_progress', label: 'En progreso' },
  { value: 'in_review', label: 'En revisión' },
  { value: 'done', label: 'Finalizada' },
  { value: 'blocked', label: 'Bloqueada' },
];

export const TASK_PRIORITIES: { value: DbTask['priority']; label: string }[] = [
  { value: 'low', label: 'Baja' },
  { value: 'medium', label: 'Media' },
  { value: 'high', label: 'Alta' },
  { value: 'critical', label: 'Crítica' },
];

const STATUS_ALIASES: Record<string, DbTask['status']> = {
  'por hacer': 'todo',
  todo: 'todo',
  pendiente: 'todo',
  'en progreso': 'in_progress',
  in_progress: 'in_progress',
  'en revisión': 'in_review',
  'en revision': 'in_review',
  in_review: 'in_review',
  finalizada: 'done',
  completada: 'done',
  done: 'done',
  bloqueada: 'blocked',
  blocked: 'blocked',
};

const PRIORITY_ALIASES: Record<string, DbTask['priority']> = {
  baja: 'low',
  low: 'low',
  media: 'medium',
  medium: 'medium',
  alta: 'high',
  high: 'high',
  crítica: 'critical',
  critica: 'critical',
  critical: 'critical',
};

/** Acepta tanto códigos de enum ('todo', 'done', ...) como etiquetas en español ('Por hacer', 'Finalizada', ...). */
export function normalizeTaskStatus(value?: string | null): DbTask['status'] {
  if (!value) return 'todo';
  return STATUS_ALIASES[value.trim().toLowerCase()] ?? 'todo';
}

/** Acepta tanto códigos de enum ('low', 'critical', ...) como etiquetas en español ('Baja', 'Crítica', ...). */
export function normalizeTaskPriority(value?: string | null): DbTask['priority'] {
  if (!value) return 'medium';
  return PRIORITY_ALIASES[value.trim().toLowerCase()] ?? 'medium';
}

export type { DbSubtask };
