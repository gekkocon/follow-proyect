import { cn } from '@/lib/utils';
import type { DbProject, DbTask } from '@/src/lib/supabase/types';

type ProjectStatus = DbProject['status'];
type TaskStatus = DbTask['status'];
type Status = ProjectStatus | TaskStatus;

const statusConfig: Record<Status, { label: string; className: string }> = {
  planning:   { label: 'Planificación', className: 'bg-slate-100 text-slate-600' },
  active:     { label: 'Activo',        className: 'bg-blue-100 text-blue-700' },
  on_hold:    { label: 'En pausa',      className: 'bg-amber-100 text-amber-700' },
  completed:  { label: 'Completado',    className: 'bg-green-100 text-green-700' },
  overdue:    { label: 'Atrasado',      className: 'bg-red-100 text-red-700' },
  todo:       { label: 'Por hacer',     className: 'bg-slate-100 text-slate-600' },
  in_progress:{ label: 'En progreso',   className: 'bg-blue-100 text-blue-700' },
  in_review:  { label: 'En revisión',   className: 'bg-purple-100 text-purple-700' },
  done:       { label: 'Completada',    className: 'bg-green-100 text-green-700' },
  blocked:    { label: 'Bloqueada',     className: 'bg-red-100 text-red-700' },
};

export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  const config = statusConfig[status];
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', config.className, className)}>
      {config.label}
    </span>
  );
}
