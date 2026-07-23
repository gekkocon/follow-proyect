'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from './server';
import type { ProjectFormValues } from './project-schema';
import type { ProjectWithRelations, DbUser } from './types';

export async function fetchProjectsData(): Promise<{
  projects: ProjectWithRelations[];
  users: DbUser[];
  error: string | null;
}> {
  const supabase = createServerClient();

  const { data: projects, error } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return { projects: [], users: [], error: error.message };
  if (!projects) return { projects: [], users: [], error: null };

  const ownerIds = Array.from(
    new Set(projects.map((p) => p.owner_id).filter(Boolean))
  ) as number[];
  const projectIds = projects.map((p) => p.id);

  const [{ data: ownerData }, { data: tasksData }, { data: allUsers }] =
    await Promise.all([
      supabase
        .from('users')
        .select('id, name, email, role, status, created_at, updated_at')
        .in('id', ownerIds.length ? ownerIds : [0]),
      supabase
        .from('tasks')
        .select('id, project_id, status')
        .in('project_id', projectIds.length ? projectIds : [0]),
      supabase
        .from('users')
        .select('*')
        .eq('status', 'active')
        .order('name'),
    ]);

  const projectsWithRelations: ProjectWithRelations[] = projects.map((p) => ({
    ...p,
    owner: ownerData?.find((u) => u.id === p.owner_id) ?? null,
    tasks: (tasksData ?? []).filter((t) => t.project_id === p.id),
  }));

  return { projects: projectsWithRelations, users: allUsers ?? [], error: null };
}

export async function createProject(
  values: ProjectFormValues
): Promise<{ error: string | null }> {
  const supabase = createServerClient();

  const { error } = await supabase.from('projects').insert({
    name: values.name,
    description: values.description || null,
    status: values.status,
    priority: values.priority,
    owner_id: values.owner_id ? parseInt(values.owner_id) : null,
    start_date: values.start_date || null,
    due_date: values.due_date || null,
  });

  if (error) return { error: error.message };
  revalidatePath('/projects');
  return { error: null };
}

export async function updateProject(
  id: number,
  values: ProjectFormValues
): Promise<{ error: string | null }> {
  const supabase = createServerClient();

  const { error } = await supabase
    .from('projects')
    .update({
      name: values.name,
      description: values.description || null,
      status: values.status,
      priority: values.priority,
      owner_id: values.owner_id ? parseInt(values.owner_id) : null,
      start_date: values.start_date || null,
      due_date: values.due_date || null,
    })
    .eq('id', id);

  if (error) return { error: error.message };
  revalidatePath('/projects');
  revalidatePath(`/projects/${id}`);
  return { error: null };
}

export async function deleteProject(
  id: number,
  force = false
): Promise<{ error: string | null; hasTasksError?: boolean; taskCount?: number }> {
  const supabase = createServerClient();

  const { count } = await supabase
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', id);

  const taskCount = count ?? 0;

  if (taskCount > 0 && !force) {
    return {
      error: 'Este proyecto tiene tareas asociadas.',
      hasTasksError: true,
      taskCount,
    };
  }

  if (force && taskCount > 0) {
    const { data: taskRows } = await supabase
      .from('tasks')
      .select('id')
      .eq('project_id', id);
    const taskIds = (taskRows ?? []).map((t) => t.id);

    if (taskIds.length > 0) {
      const { data: subtaskRows } = await supabase
        .from('subtasks')
        .select('id')
        .in('task_id', taskIds);
      const subtaskIds = (subtaskRows ?? []).map((s) => s.id);

      if (subtaskIds.length > 0) {
        await supabase.from('subtask_assignees').delete().in('subtask_id', subtaskIds);
        await supabase.from('subtasks').delete().in('task_id', taskIds);
      }

      await supabase.from('task_assignees').delete().in('task_id', taskIds);
      await supabase.from('tasks').delete().eq('project_id', id);
    }
  }

  await supabase.from('project_members').delete().eq('project_id', id);

  const { error } = await supabase.from('projects').delete().eq('id', id);
  if (error) return { error: error.message };

  revalidatePath('/projects');
  revalidatePath('/tasks');
  return { error: null };
}
