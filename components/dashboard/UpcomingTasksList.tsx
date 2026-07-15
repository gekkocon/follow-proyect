import Link from 'next/link';
import { differenceInDays, parseISO, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarDays, AlertOctagon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StatusBadge } from '@/components/projects/StatusBadge';
import { PriorityBadge } from '@/components/projects/PriorityBadge';
import type { DbTask } from '@/src/lib/supabase/types';

type UpcomingTask = Pick<
  DbTask,
  'id' | 'title' | 'status' | 'priority' | 'due_date' | 'project_id' | 'is_blocked'
> & { projectName: string | null };

export function UpcomingTasksList({ tasks }: { tasks: UpcomingTask[] }) {
  const today = new Date();

  return (
    <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
        <CalendarDays size={15} className="text-muted-foreground" />
        <h2 className="text-sm font-semibold text-foreground">Tareas · próximos 7 días</h2>
        <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {tasks.length}
        </span>
      </div>

      {tasks.length === 0 ? (
        <div className="px-5 py-10 text-center text-sm text-muted-foreground">
          Sin tareas venciendo en los próximos 7 días 🎉
        </div>
      ) : (
        <div className="divide-y divide-border max-h-[420px] overflow-y-auto">
          {tasks.map((task) => {
            const daysLeft = task.due_date
              ? differenceInDays(parseISO(task.due_date), today)
              : null;
            const urgent = daysLeft !== null && daysLeft <= 1;

            return (
              <div key={task.id} className="px-5 py-3 hover:bg-muted/30 transition-colors">
                {/* Task title */}
                <div className="flex items-start gap-2">
                  {task.is_blocked && (
                    <AlertOctagon size={13} className="mt-0.5 shrink-0 text-red-500" />
                  )}
                  <p className="text-sm font-medium text-foreground leading-snug line-clamp-1 flex-1">
                    {task.title}
                  </p>
                </div>

                {/* Meta row */}
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  <StatusBadge status={task.status} />
                  <PriorityBadge priority={task.priority} />

                  {task.projectName && (
                    <Link
                      href={`/projects/${task.project_id}`}
                      className="text-xs text-muted-foreground hover:text-primary transition-colors truncate max-w-[120px]"
                    >
                      {task.projectName}
                    </Link>
                  )}

                  {task.due_date && (
                    <span
                      className={cn(
                        'ml-auto flex items-center gap-1 text-xs font-medium shrink-0',
                        urgent ? 'text-red-600' : 'text-muted-foreground'
                      )}
                    >
                      <CalendarDays size={11} />
                      {daysLeft === 0
                        ? 'Hoy'
                        : daysLeft === 1
                        ? 'Mañana'
                        : format(parseISO(task.due_date), 'd MMM', { locale: es })}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
