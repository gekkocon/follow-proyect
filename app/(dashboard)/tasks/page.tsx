import { createServerClient } from '@/src/lib/supabase/server';
import { TasksClient } from '@/components/tasks/TasksClient';
import { getActiveUser, isGlobalAdmin } from '@/src/lib/supabase/active-user';
import { getVisibleProjectIds } from '@/src/lib/supabase/member-actions';
import type { TaskWithRelations, DbUser, DbSubtask } from '@/src/lib/supabase/types';

export type TaskListItem = TaskWithRelations & {
  subtasks: Pick<DbSubtask, 'id' | 'title' | 'status' | 'due_date' | 'completed'>[];
};

async function getTasksData(): Promise<{
  tasks: TaskListItem[];
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

  const taskIds = (tasks ?? []).map((t) => t.id);
  const { data: subtasksRaw } = taskIds.length
    ? await supabase
        .from('subtasks')
        .select('id, title, status, due_date, completed, task_id')
        .in('task_id', taskIds)
    : { data: [] };

  const subtasksByTask = new Map<number, TaskListItem['subtasks']>();
  for (const s of subtasksRaw ?? []) {
    const list = subtasksByTask.get(s.task_id) ?? [];
    list.push({ id: s.id, title: s.title, status: s.status, due_date: s.due_date, completed: s.completed });
    subtasksByTask.set(s.task_id, list);
  }

  const projectMap = Object.fromEntries(
    (projects ?? []).map((p) => [p.id, p])
  );
  const userMap = Object.fromEntries(
    (users ?? []).map((u) => [u.id, u])
  );

  const tasksWithRelations: TaskListItem[] = (tasks ?? []).map((t) => ({
    ...t,
    project:  t.project_id  ? (projectMap[t.project_id]  ?? null) : null,
    assignee: t.assignee_id ? (userMap[t.assignee_id]    ?? null) : null,
    subtasks: subtasksByTask.get(t.id) ?? [],
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
