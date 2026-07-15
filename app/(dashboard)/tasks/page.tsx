import { createServerClient } from '@/src/lib/supabase/server';
import { TasksClient } from '@/components/tasks/TasksClient';
import { getActiveUser, isGlobalAdmin } from '@/src/lib/supabase/active-user';
import { getVisibleProjectIds } from '@/src/lib/supabase/member-actions';
import type { TaskWithRelations, DbUser } from '@/src/lib/supabase/types';

async function getTasksData(): Promise<{
  tasks: TaskWithRelations[];
  users: Pick<DbUser, 'id' | 'name'>[];
  error: string | null;
}> {
  const supabase = createServerClient();
  const activeUser = await getActiveUser();
  if (!activeUser) return { tasks: [], users: [], error: null };
  const visibleIds = await getVisibleProjectIds(activeUser.id, isGlobalAdmin(activeUser));

  const [{ data: projects }, { data: users }] = await Promise.all([
    supabase.from('projects').select('id, name'),
    supabase.from('users').select('id, name').eq('status', 'active').order('name'),
  ]);

  // Filter tasks to only visible projects
  const projectIds = visibleIds !== null
    ? visibleIds
    : (projects ?? []).map((p: { id: number }) => p.id);

  let tasksQuery = supabase
    .from('tasks')
    .select('*')
    .order('created_at', { ascending: false });
  if (projectIds.length > 0) {
    tasksQuery = tasksQuery.in('project_id', projectIds);
  } else if (visibleIds !== null) {
    // non-admin with no projects → return empty
    return { tasks: [], users: users ?? [], error: null };
  }

  const { data: tasks, error } = await tasksQuery;

  if (error) return { tasks: [], users: [], error: error.message };

  const projectMap = Object.fromEntries(
    (projects ?? []).map((p) => [p.id, p])
  );
  const userMap = Object.fromEntries(
    (users ?? []).map((u) => [u.id, u])
  );

  const tasksWithRelations: TaskWithRelations[] = (tasks ?? []).map((t) => ({
    ...t,
    project:  t.project_id  ? (projectMap[t.project_id]  ?? null) : null,
    assignee: t.assignee_id ? (userMap[t.assignee_id]    ?? null) : null,
  }));

  return {
    tasks: tasksWithRelations,
    users: users ?? [],
    error: null,
  };
}

export default async function TasksPage() {
  const { tasks, users, error } = await getTasksData();

  return <TasksClient initialTasks={tasks} users={users} error={error} />;
}
