import Link from 'next/link';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowRight } from 'lucide-react';
import { StatusBadge } from '@/components/projects/StatusBadge';
import { ProgressBar } from '@/components/projects/ProgressBar';
import type { DbProject } from '@/src/lib/supabase/types';

type RecentProject = Pick<DbProject, 'id' | 'name' | 'status' | 'due_date' | 'updated_at'> & {
  tasksDone: number;
  tasksTotal: number;
};

export function RecentProjectsTable({ projects }: { projects: RecentProject[] }) {
  return (
    <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground">Proyectos recientes</h2>
        <Link
          href="/projects"
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          Ver todos <ArrowRight size={12} />
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="px-5 py-10 text-center text-sm text-muted-foreground">
          No hay proyectos todavía.
        </div>
      ) : (
        <div className="divide-y divide-border">
          {projects.map((p) => (
            <Link
              key={p.id}
              href={`/projects/${p.id}`}
              className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/40 transition-colors group"
            >
              {/* Name + progress */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                  {p.name}
                </p>
                {p.tasksTotal > 0 && (
                  <div className="mt-1.5 max-w-[200px]">
                    <ProgressBar done={p.tasksDone} total={p.tasksTotal} showLabel={false} />
                  </div>
                )}
              </div>

              {/* Status */}
              <StatusBadge status={p.status} />

              {/* Tasks fraction */}
              <span className="text-xs tabular-nums text-muted-foreground w-10 text-right shrink-0">
                {p.tasksDone}/{p.tasksTotal}
              </span>

              {/* Updated */}
              <span className="hidden sm:block text-xs text-muted-foreground shrink-0 w-24 text-right">
                {formatDistanceToNow(parseISO(p.updated_at), { locale: es, addSuffix: true })}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
