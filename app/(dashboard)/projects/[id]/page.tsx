import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, CalendarDays, User } from 'lucide-react';
import { format, isPast, parseISO, isToday } from 'date-fns';
import { es } from 'date-fns/locale';
import { createServerClient } from '@/src/lib/supabase/server';
import { getProjectWorkPlan } from '@/src/lib/supabase/project-task-actions';
import { StatusBadge } from '@/components/projects/StatusBadge';
import { PriorityBadge } from '@/components/projects/PriorityBadge';
import { ProgressBar } from '@/components/projects/ProgressBar';
import { EditProjectPanel } from '@/components/projects/EditProjectPanel';
import { ProjectTasksClient } from '@/components/projects/ProjectTasksClient';
import { ProjectTeamSection } from '@/components/projects/ProjectTeamSection';
import { getProjectMembers } from '@/src/lib/supabase/member-actions';
import { getActiveUser, canManageTeam } from '@/src/lib/supabase/active-user';
import type {
  DbProject,
  DbUser,
  ProjectWithRelations,
} from '@/src/lib/supabase/types';

// ─────────────────────────────────────────────
// Data fetchers
// ─────────────────────────────────────────────

async function getProject(
  id: number
): Promise<(DbProject & { owner: DbUser | null }) | null> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .single();
  if (!data) return null;

  const owner = data.owner_id
    ? (
        await supabase
          .from('users')
          .select('*')
          .eq('id', data.owner_id)
          .single()
      ).data
    : null;

  return { ...data, owner };
}

async function getActiveUsers(): Promise<Pick<DbUser, 'id' | 'name'>[]> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from('users')
    .select('id, name')
    .eq('status', 'active')
    .order('name');
  return data ?? [];
}

async function getAllUsers(): Promise<DbUser[]> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('status', 'active')
    .order('name');
  return data ?? [];
}

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────

export default async function ProjectDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const id = parseInt(params.id);
  if (isNaN(id)) notFound();

  const activeUser = await getActiveUser();
  const [project, workPlan, activeUsers, allUsers, members] = await Promise.all([
    getProject(id),
    getProjectWorkPlan(id),
    getActiveUsers(),
    getAllUsers(),
    getProjectMembers(id),
  ]);
  if (!project) notFound();

  // Etapa 1, paso 1B — el conteo sigue leyendo la lista PLANA. Leer el árbol
  // devolvería la cantidad de fases, que es un número plausible y equivocado.
  const tasksDone = workPlan.allTasks.filter((t) => t.status === 'done').length;
  const tasksTotal = workPlan.allTasks.length;

  const isOverdue =
    project.due_date &&
    project.status !== 'completed' &&
    isPast(parseISO(project.due_date)) &&
    !isToday(parseISO(project.due_date));

  const projectWithRelations: ProjectWithRelations = {
    ...project,
    tasks: workPlan.allTasks.map((t) => ({ id: t.id, status: t.status, project_id: t.project_id })),
  };

  return (
    <div className="max-w-4xl">
      {/* Breadcrumb */}
      <Link
        href="/projects"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-5"
      >
        <ChevronLeft size={15} />
        Proyectos
      </Link>

      {/* Project header */}
      <div className="rounded-xl border border-border bg-white p-6 shadow-sm mb-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-semibold text-foreground">{project.name}</h1>
            {project.description && (
              <p className="mt-1 text-sm text-muted-foreground max-w-xl">
                {project.description}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <PriorityBadge priority={project.priority} />
            <StatusBadge status={project.status} />
            {isOverdue && (
              <span className="text-xs font-medium text-red-600">⚠ Atrasado</span>
            )}
            <EditProjectPanel project={projectWithRelations} users={allUsers} />
          </div>
        </div>

        {/* Meta row */}
        <div className="mt-4 flex flex-wrap gap-5 text-sm text-muted-foreground">
          {project.owner && (
            <span className="flex items-center gap-1.5">
              <User size={13} />
              {project.owner.name}
            </span>
          )}
          {project.start_date && (
            <span className="flex items-center gap-1.5">
              <CalendarDays size={13} />
              Inicio:{' '}
              {format(parseISO(project.start_date), "d 'de' MMMM yyyy", { locale: es })}
            </span>
          )}
          {project.due_date && (
            <span
              className={`flex items-center gap-1.5 ${isOverdue ? 'text-red-500' : ''}`}
            >
              <CalendarDays size={13} />
              Entrega:{' '}
              {format(parseISO(project.due_date), "d 'de' MMMM yyyy", { locale: es })}
            </span>
          )}
        </div>

        {/* Progress
            Etapa 1, paso 1B — el avance es el promedio de las fases, calculado
            al leer y nunca guardado. Las tareas sin fase no entran (D-15): el
            bloque "Sin fase" muestra el suyo en su propia cabecera. La regla
            entera vive en projectProgress(), en src/lib/work-plan.ts. */}
        {workPlan.progress !== null && (
          <div className="mt-4">
            <div
              className="flex justify-between text-xs text-muted-foreground mb-1.5"
              title="Promedio de subtareas completadas por tarea — no es un conteo de tareas."
            >
              <span>Avance por subtareas</span>
              <span>{workPlan.progress.toFixed(1)}%</span>
            </div>
            <ProgressBar done={Math.round(workPlan.progress)} total={100} showLabel={false} />
            <div className="mt-1.5 text-right text-xs text-muted-foreground">
              Tareas finalizadas: {tasksDone}/{tasksTotal}
            </div>
          </div>
        )}
      </div>

      {/* Team */}
      <ProjectTeamSection
        projectId={id}
        initialMembers={members}
        allUsers={allUsers}
        canManage={activeUser ? canManageTeam(activeUser) : false}
      />

      {/* Tasks — interactive client component */}
      <ProjectTasksClient
        initialWorkPlan={workPlan}
        users={activeUsers}
        projectId={id}
      />
    </div>
  );
}
