'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from './server';
import type { DbTask, DbSubtask, DbUser, TaskWithFullRelations, SubtaskWithAssignees } from './types';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

async function syncTaskAssignees(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  taskId: number,
  assigneeIds: number[]
) {
  await supabase.from('task_assignees').delete().eq('task_id', taskId);
  if (assigneeIds.length) {
    await supabase
      .from('task_assignees')
      .insert(assigneeIds.map((uid) => ({ task_id: taskId, user_id: uid })));
  }
}

async function syncSubtaskAssignees(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  subtaskId: number,
  assigneeIds: number[]
) {
  await supabase.from('subtask_assignees').delete().eq('subtask_id', subtaskId);
  if (assigneeIds.length) {
    await supabase
      .from('subtask_assignees')
      .insert(assigneeIds.map((uid) => ({ subtask_id: subtaskId, user_id: uid })));
  }
}

// ─────────────────────────────────────────────
// TASKS
// ─────────────────────────────────────────────

type TaskInput = {
  title: string;
  status: DbTask['status'];
  priority: DbTask['priority'];
  description?: string | null;
  start_date?: string | null;
  due_date?: string | null;
  estimated_cost?: number | null;
  is_blocked?: boolean;
  blocked_reason?: string | null;
};

export async function createProjectTask(
  projectId: number,
  data: TaskInput,
  assigneeIds: number[]
): Promise<{ id: number | null; error: string | null }> {
  const supabase = createServerClient();
  const { data: task, error } = await supabase
    .from('tasks')
    .insert({ ...data, project_id: projectId })
    .select('id')
    .single();

  if (error || !task) return { id: null, error: error?.message ?? 'Error al crear la tarea' };

  await syncTaskAssignees(supabase, task.id, assigneeIds);

  revalidatePath(`/projects/${projectId}`);
  revalidatePath('/dashboard');
  return { id: task.id, error: null };
}

export async function updateProjectTask(
  taskId: number,
  projectId: number,
  data: Partial<TaskInput>,
  assigneeIds: number[]
): Promise<{ error: string | null }> {
  const supabase = createServerClient();
  const { error } = await supabase.from('tasks').update(data).eq('id', taskId);
  if (error) return { error: error.message };

  await syncTaskAssignees(supabase, taskId, assigneeIds);

  revalidatePath(`/projects/${projectId}`);
  revalidatePath('/dashboard');
  return { error: null };
}

export async function deleteProjectTask(
  taskId: number,
  projectId: number
): Promise<{ error: string | null }> {
  const supabase = createServerClient();

  const { count } = await supabase
    .from('subtasks')
    .select('id', { count: 'exact', head: true })
    .eq('task_id', taskId);

  if ((count ?? 0) > 0) {
    return { error: 'No se puede eliminar una tarea que tiene subtareas. Elimínalas primero.' };
  }

  const { error } = await supabase.from('tasks').delete().eq('id', taskId);
  if (error) return { error: error.message };

  revalidatePath(`/projects/${projectId}`);
  revalidatePath('/dashboard');
  return { error: null };
}

// ─────────────────────────────────────────────
// SUBTASKS
// ─────────────────────────────────────────────

type SubtaskInput = {
  title: string;
  status: DbSubtask['status'];
  priority: DbSubtask['priority'];
  description?: string | null;
  start_date?: string | null;
  due_date?: string | null;
  estimated_cost?: number | null;
};

export async function createProjectSubtask(
  taskId: number,
  projectId: number,
  data: SubtaskInput,
  assigneeIds: number[]
): Promise<{ id: number | null; error: string | null }> {
  const supabase = createServerClient();
  const { data: subtask, error } = await supabase
    .from('subtasks')
    .insert({ ...data, task_id: taskId, completed: data.status === 'done' })
    .select('id')
    .single();

  if (error || !subtask) return { id: null, error: error?.message ?? 'Error al crear la subtarea' };

  await syncSubtaskAssignees(supabase, subtask.id, assigneeIds);

  revalidatePath(`/projects/${projectId}`);
  return { id: subtask.id, error: null };
}

export async function updateProjectSubtask(
  subtaskId: number,
  projectId: number,
  data: Partial<SubtaskInput>,
  assigneeIds: number[]
): Promise<{ error: string | null }> {
  const supabase = createServerClient();
  const updateData = {
    ...data,
    ...(data.status !== undefined ? { completed: data.status === 'done' } : {}),
  };
  const { error } = await supabase.from('subtasks').update(updateData).eq('id', subtaskId);
  if (error) return { error: error.message };

  await syncSubtaskAssignees(supabase, subtaskId, assigneeIds);

  revalidatePath(`/projects/${projectId}`);
  return { error: null };
}

export async function deleteProjectSubtask(
  subtaskId: number,
  projectId: number
): Promise<{ error: string | null }> {
  const supabase = createServerClient();
  const { error } = await supabase.from('subtasks').delete().eq('id', subtaskId);
  if (error) return { error: error.message };

  revalidatePath(`/projects/${projectId}`);
  return { error: null };
}

// ─────────────────────────────────────────────
// FULL REFRESH (used by the client after any create/update/import
// instead of relying solely on router.refresh(), which raced with the
// DB write and could leave newly-created subtasks invisible until a
// manual reload)
// ─────────────────────────────────────────────

export async function getProjectTasksFull(projectId: number): Promise<TaskWithFullRelations[]> {
  const supabase = createServerClient();

  const { data: tasks } = await supabase
    .from('tasks')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });

  if (!tasks?.length) return [];

  const taskIds = tasks.map((t) => t.id);

  const [{ data: taskAssigneeRows }, { data: subtasks }] = await Promise.all([
    supabase
      .from('task_assignees')
      .select('task_id, users(id, name)')
      .in('task_id', taskIds),
    supabase
      .from('subtasks')
      .select('*')
      .in('task_id', taskIds)
      .order('created_at', { ascending: true }),
  ]);

  const subtaskIds = (subtasks ?? []).map((s) => s.id);
  const { data: subtaskAssigneeRows } = subtaskIds.length
    ? await supabase
        .from('subtask_assignees')
        .select('subtask_id, users(id, name)')
        .in('subtask_id', subtaskIds)
    : { data: [] };

  const enrichedSubtasks: SubtaskWithAssignees[] = (subtasks ?? []).map((s) => ({
    ...s,
    status: s.status ?? 'todo',
    due_date: s.due_date ?? null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    assignees: (subtaskAssigneeRows ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((r: any) => r.subtask_id === s.id)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((r: any) => r.users)
      .filter(Boolean) as Pick<DbUser, 'id' | 'name'>[],
  }));

  return tasks.map((t) => ({
    ...t,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    assignees: (taskAssigneeRows ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((r: any) => r.task_id === t.id)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((r: any) => r.users)
      .filter(Boolean) as Pick<DbUser, 'id' | 'name'>[],
    subtasks: enrichedSubtasks.filter((s) => s.task_id === t.id),
  }));
}
