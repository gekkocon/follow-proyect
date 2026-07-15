import {
  FolderKanban,
  Zap,
  AlertTriangle,
  ClipboardList,
  Ban,
  TrendingUp,
} from 'lucide-react';
import { isPast, parseISO, addDays, isWithinInterval, startOfDay } from 'date-fns';
import { createServerClient } from '@/src/lib/supabase/server';
import { KpiCard } from '@/components/dashboard/KpiCard';
import { RecentProjectsTable } from '@/components/dashboard/RecentProjectsTable';
import { UpcomingTasksList } from '@/components/dashboard/UpcomingTasksList';
import { TaskStatusChart } from '@/components/dashboard/TaskStatusChart';
import { getActiveUser, isGlobalAdmin } from '@/src/lib/supabase/active-user';
import { getVisibleProjectIds } from '@/src/lib/supabase/member-actions';

// ─── Types ────────────────────────────────────────────────────────────────────

type ProjectRow = {
  id: number;
  name: string;
  status: 'planning' | 'active' | 'on_hold' | 'completed' | 'overdue';
  priority: 'low' | 'medium' | 'high' | 'critical';
  due_date: string | null;
  updated_at: string;
};

type TaskRow = {
  id: number;
  title: string;
  status: 'todo' | 'in_progress' | 'in_review' | 'done' | 'blocked';
  priority: 'low' | 'medium' | 'high' | 'critical';
  project_id: number | null;
  due_date: string | null;
  is_blocked: boolean;
};

// ─── Pure computation ─────────────────────────────────────────────────────────

function buildDashboard(safeProjects: ProjectRow[], safeTasks: TaskRow[]) {
  const totalProjects  = safeProjects.length;
  const activeProjects = safeProjects.filter((p) => p.status === 'active').length;
  const overdueProjects = safeProjects.filter((p) => {
    if (p.status === 'completed') return false;
    if (p.status === 'overdue') return true;
    return p.due_date && isPast(parseISO(p.due_date));
  }).length;

  const totalTasks    = safeTasks.length;
  const doneTasks     = safeTasks.filter((t) => t.status === 'done').length;
  const pendingTasks  = safeTasks.filter((t) => t.status !== 'done').length;
  const blockedTasks  = safeTasks.filter((t) => t.is_blocked || t.status === 'blocked').length;
  const completionPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  const recentProjects = [...safeProjects]
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 5)
    .map((p) => ({
      ...p,
      tasksDone:  safeTasks.filter((t) => t.project_id === p.id && t.status === 'done').length,
      tasksTotal: safeTasks.filter((t) => t.project_id === p.id).length,
    }));

  const today = startOfDay(new Date());
  const in7   = addDays(today, 7);
  const projectMap = Object.fromEntries(safeProjects.map((p) => [p.id, p.name]));

  const upcomingTasks = safeTasks
    .filter((t) => {
      if (!t.due_date || t.status === 'done') return false;
      return isWithinInterval(parseISO(t.due_date), { start: today, end: in7 });
    })
    .sort((a, b) => parseISO(a.due_date!).getTime() - parseISO(b.due_date!).getTime())
    .slice(0, 12)
    .map((t) => ({ ...t, projectName: projectMap[t.project_id ?? -1] ?? null }));

  const statusBars = [
    { label: 'Completadas', count: doneTasks,                                                              color: 'bg-green-500'  },
    { label: 'En progreso', count: safeTasks.filter((t) => t.status === 'in_progress').length,             color: 'bg-blue-500'   },
    { label: 'En revisión', count: safeTasks.filter((t) => t.status === 'in_review').length,               color: 'bg-purple-500' },
    { label: 'Por hacer',   count: safeTasks.filter((t) => t.status === 'todo').length,                    color: 'bg-slate-400'  },
    { label: 'Bloqueadas',  count: safeTasks.filter((t) => t.is_blocked || t.status === 'blocked').length, color: 'bg-red-500'    },
  ];

  return {
    kpis: { totalProjects, activeProjects, overdueProjects, pendingTasks, blockedTasks, completionPct, totalTasks, doneTasks },
    recentProjects,
    upcomingTasks,
    statusBars,
    totalTasks,
  };
}

// ─── Data fetching ────────────────────────────────────────────────────────────

async function getDashboardData() {
  const supabase   = createServerClient();
  const activeUser = await getActiveUser();
  if (!activeUser) return buildDashboard([], []);
  const visibleIds = await getVisibleProjectIds(activeUser.id, isGlobalAdmin(activeUser));

  // Project query — filtered by membership for non-admins
  let projectQuery = supabase
    .from('projects')
    .select('id, name, status, priority, due_date, updated_at');
  if (visibleIds !== null) {
    projectQuery = projectQuery.in('id', visibleIds.length ? visibleIds : [-1]);
  }

  const { data: projectsRaw } = await projectQuery;
  const safeProjects = (projectsRaw ?? []) as ProjectRow[];

  // Early return for non-admin with no visible projects
  if (visibleIds !== null && safeProjects.length === 0) {
    return buildDashboard([], []);
  }

  // Task query — restricted to visible project ids
  const projectIds = safeProjects.map((p) => p.id);
  let taskQuery = supabase
    .from('tasks')
    .select('id, title, status, priority, project_id, due_date, is_blocked');
  if (projectIds.length > 0) {
    taskQuery = taskQuery.in('project_id', projectIds);
  }

  const { data: tasksRaw } = await taskQuery;
  const safeTasks = (tasksRaw ?? []) as TaskRow[];

  return buildDashboard(safeProjects, safeTasks);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const { kpis, recentProjects, upcomingTasks, statusBars, totalTasks } =
    await getDashboardData();

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Resumen en tiempo real — proyectos, tareas y estado general.
        </p>
      </div>

      {/* ── KPI grid ── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          icon={FolderKanban}
          label="Total proyectos"
          value={kpis.totalProjects}
          variant="default"
        />
        <KpiCard
          icon={Zap}
          label="Proyectos activos"
          value={kpis.activeProjects}
          variant="blue"
        />
        <KpiCard
          icon={AlertTriangle}
          label="Atrasados"
          value={kpis.overdueProjects}
          variant={kpis.overdueProjects > 0 ? 'red' : 'default'}
        />
        <KpiCard
          icon={ClipboardList}
          label="Tareas pendientes"
          value={kpis.pendingTasks}
          variant="amber"
        />
        <KpiCard
          icon={Ban}
          label="Tareas bloqueadas"
          value={kpis.blockedTasks}
          variant={kpis.blockedTasks > 0 ? 'orange' : 'default'}
        />
        <KpiCard
          icon={TrendingUp}
          label="Completado global"
          value={`${kpis.completionPct}%`}
          sub={`${kpis.doneTasks} de ${kpis.totalTasks} tareas`}
          variant="green"
          progress={kpis.completionPct}
        />
      </div>

      {/* ── Middle row: recent projects + task chart ── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RecentProjectsTable projects={recentProjects} />
        </div>
        <div>
          <TaskStatusChart bars={statusBars} total={totalTasks} />
        </div>
      </div>

      {/* ── Bottom: upcoming tasks ── */}
      <UpcomingTasksList tasks={upcomingTasks} />
    </div>
  );
}
