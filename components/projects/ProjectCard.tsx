import Link from 'next/link';
import { AlertTriangle, CalendarDays } from 'lucide-react';
import { format, isPast, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { StatusBadge } from './StatusBadge';
import { PriorityBadge } from './PriorityBadge';
import { ProgressBar } from './ProgressBar';
import type { ProjectWithRelations } from '@/src/lib/supabase/types';

type Props = { project: ProjectWithRelations };

export function ProjectCard({ project }: Props) {
  const tasksDone  = project.tasks.filter((t) => t.status === 'done').length;
  const tasksTotal = project.tasks.length;

  const isOverdue =
    project.due_date &&
    project.status !== 'completed' &&
    isPast(parseISO(project.due_date));

  return (
    <Link
      href={`/projects/${project.id}`}
      className="group flex flex-col gap-3 rounded-xl border border-border bg-white p-5 shadow-sm hover:shadow-md hover:border-primary/30 transition-all"
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-snug">
          {project.name}
        </h3>
        <PriorityBadge priority={project.priority} className="shrink-0" />
      </div>

      {/* Description */}
      {project.description && (
        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
          {project.description}
        </p>
      )}

      {/* Status + overdue */}
      <div className="flex items-center gap-2 flex-wrap">
        <StatusBadge status={project.status} />
        {isOverdue && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600">
            <AlertTriangle size={11} />
            Atrasado
          </span>
        )}
      </div>

      {/* Progress */}
      {tasksTotal > 0 && (
        <ProgressBar done={tasksDone} total={tasksTotal} />
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border">
        <span className="truncate">
          {project.owner?.name ?? '—'}
        </span>
        {project.due_date && (
          <span className={`flex items-center gap-1 ${isOverdue ? 'text-red-500 font-medium' : ''}`}>
            <CalendarDays size={11} />
            {format(parseISO(project.due_date), "d MMM yyyy", { locale: es })}
          </span>
        )}
      </div>
    </Link>
  );
}
