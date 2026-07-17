'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from './server';
import type { DbTask, DbSubtask } from './types';

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
  due_date?: string | null;
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
  due_date?: string | null;
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
