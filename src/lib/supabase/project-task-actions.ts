'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient, createAuthServerClient } from './server';
import { getActiveUser, canManageTeam } from './active-user';
import { buildWorkPlan, type ProjectWorkPlan } from '@/src/lib/work-plan';
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
  await supabase
    .from('assignments')
    .delete()
    .eq('assignable_type', 'task')
    .eq('assignable_id', taskId);
  await supabase.from('task_assignees').delete().eq('task_id', taskId); // Sale en la 014

  if (assigneeIds.length) {
    await supabase.from('assignments').insert(
      assigneeIds.map((uid) => ({
        assignable_type: 'task',
        assignable_id: taskId,
        user_id: uid,
      }))
    );
  }
}

async function syncSubtaskAssignees(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  subtaskId: number,
  assigneeIds: number[]
) {
  await supabase
    .from('assignments')
    .delete()
    .eq('assignable_type', 'subtask')
    .eq('assignable_id', subtaskId);
  await supabase.from('subtask_assignees').delete().eq('subtask_id', subtaskId); // Sale en la 014

  if (assigneeIds.length) {
    await supabase.from('assignments').insert(
      assigneeIds.map((uid) => ({
        assignable_type: 'subtask',
        assignable_id: subtaskId,
        user_id: uid,
      }))
    );
  }
}

/**
 * Fase 8A — reserves the next human-readable code.
 *
 * Allocation lives in Postgres (`alloc_task_code_in_phase` /
 * `alloc_subtask_code`, migration 010) because it bumps a burn counter in the
 * same statement that reads it: the code is identity, so it is never
 * renumbered and never reused after a delete. Doing it here with a
 * MAX(code) + 1 read would hand the same code to two concurrent inserts and
 * would recycle the code of a deleted row.
 *
 * Etapa 1, paso 1G / deuda 14 — a failed allocation now ABORTS instead of
 * returning null and letting the insert land without a code: the null path
 * predates the role/membership gate on these RPCs, and a rejected call needs
 * a visible error, not a silently code-less row. Same stance as `createPhase`
 * and `moveTaskToPhase`.
 */
async function allocCode(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  fn: 'alloc_task_code_in_phase' | 'alloc_subtask_code',
  args: Record<string, number>
): Promise<{ code: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) return { code: null, error: error.message };

  const code = String(data ?? '').trim();
  if (!code) return { code: null, error: 'No se pudo generar el código.' };

  return { code, error: null };
}

/**
 * Etapa 1, paso 1B — indexes assignment rows by the row they point at.
 *
 * Replaces a `.filter()` inside a `.map()`, which was O(n·m): 106 subtasks
 * times every assignment row, and 37 tasks times 106 subtasks. A Map is built
 * once and read in constant time.
 *
 * Insertion order is preserved, so walking the rows in the order the query
 * returned them yields exactly the arrays the old `.filter()` produced.
 */
function groupAssignees(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rows: any[] | null | undefined
): Map<number, Pick<DbUser, 'id' | 'name'>[]> {
  const map = new Map<number, Pick<DbUser, 'id' | 'name'>[]>();

  for (const row of rows ?? []) {
    const user = row?.users as Pick<DbUser, 'id' | 'name'> | null | undefined;
    if (!user) continue;

    const list = map.get(row.assignable_id);
    if (list) list.push(user);
    else map.set(row.assignable_id, [user]);
  }

  return map;
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
  is_blocked?: boolean;
  blocked_reason?: string | null;
};

/**
 * Etapa 1, paso 1F-b — `phaseId` is mandatory: `tasks.phase_id` is `NOT NULL`
 * since migration 013f, and the orphan allocator (`alloc_task_code`) is
 * being retired. The code always comes from `alloc_task_code_in_phase`.
 */
export async function createProjectTask(
  projectId: number,
  data: TaskInput,
  assigneeIds: number[],
  phaseId: number
): Promise<{ id: number | null; error: string | null }> {
  const supabase = await createAuthServerClient();
  const { code, error: codeError } = await allocCode(supabase, 'alloc_task_code_in_phase', { p_phase_id: phaseId });
  if (codeError) return { id: null, error: codeError };

  const { data: task, error } = await supabase
    .from('tasks')
    .insert({
      ...data,
      project_id: projectId,
      phase_id: phaseId,
      code,
    })
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
  const activeUser = await getActiveUser();
  if (!activeUser) return { error: 'No autenticado.' };
  if (!canManageTeam(activeUser)) return { error: 'No autorizado.' };

  const supabase = await createAuthServerClient();

  const { count } = await supabase
    .from('subtasks')
    .select('id', { count: 'exact', head: true })
    .eq('task_id', taskId);

  if ((count ?? 0) > 0) {
    return { error: 'No se puede eliminar una tarea que tiene subtareas. Elimínalas primero.' };
  }

  await syncTaskAssignees(supabase, taskId, []);

  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', taskId)
    .eq('project_id', projectId);
  if (error) return { error: error.message };

  revalidatePath(`/projects/${projectId}`);
  revalidatePath('/dashboard');
  return { error: null };
}

// ─────────────────────────────────────────────
// MOVE BETWEEN PHASES (Etapa 1, paso C-1)
// ─────────────────────────────────────────────

/**
 * Etapa 1, paso C-1 — moves a task into a phase and reallocates its code
 * from the destination watermark.
 *
 * The move is one-way: a task enters a phase, it never returns to the
 * project-level orphan namespace. Allowing "Sin fase" as a destination
 * would mint by hand exactly the orphan rows the create path forbids, and
 * would put a second allocator in play for one operation.
 *
 * The code is NOT carried over. A task leaving F1 as T03 enters F4 with
 * F4's next number; T03 stays burned in F1 because watermarks never
 * decrease. Carrying the code over would collide with the destination's
 * unique index (`idx_tasks_phase_code`) the moment that number is taken
 * there.
 *
 * Validation runs BEFORE the allocation on purpose: a rejected move must
 * not consume a code of the destination phase. And a failed allocation
 * ABORTS instead of writing `phase_id` alone — that would land the task in
 * the new phase still wearing its old code, which is the silent drift this
 * counter design exists to prevent. Same stance as `createPhase`, opposite
 * to the `allocCode` helper above (deuda #14).
 *
 * Subtask codes are local to the task (`tasks.subtask_code_seq`) and are
 * not touched: `composeCode` rebuilds them under the task's new code on the
 * next render.
 *
 * Nothing is logged. The repo has no audit trail of any kind (deuda #16),
 * and `legacy_code` is not a place to stash the previous code: it holds the
 * pre-Etapa-1 code and overwriting it would destroy the only trace of
 * migration 013.
 */
export async function moveTaskToPhase(
  taskId: number,
  projectId: number,
  targetPhaseId: number
): Promise<{ code: string | null; error: string | null }> {
  const supabase = await createAuthServerClient();

  // `maybeSingle` and not `single`: a missing row is an expected outcome
  // here and deserves its own message, not PostgREST's zero-rows error.
  const { data: task, error: taskError } = await supabase
    .from('tasks')
    .select('id, project_id, phase_id')
    .eq('id', taskId)
    .maybeSingle();

  if (taskError) return { code: null, error: taskError.message };
  if (!task) return { code: null, error: 'La tarea no existe.' };
  if (task.project_id !== projectId) {
    return { code: null, error: 'La tarea no pertenece a este proyecto.' };
  }
  if (task.phase_id === targetPhaseId) {
    return { code: null, error: 'La tarea ya está en esa fase.' };
  }

  const { data: phase, error: phaseError } = await supabase
    .from('phases')
    .select('id, project_id')
    .eq('id', targetPhaseId)
    .maybeSingle();

  if (phaseError) return { code: null, error: phaseError.message };
  if (!phase) return { code: null, error: 'La fase de destino no existe.' };
  if (phase.project_id !== projectId) {
    return { code: null, error: 'La fase de destino no pertenece a este proyecto.' };
  }

  const { data: allocated, error: rpcError } = await supabase.rpc(
    'alloc_task_code_in_phase',
    { p_phase_id: targetPhaseId }
  );

  if (rpcError) return { code: null, error: rpcError.message };

  const code = String(allocated ?? '').trim();
  if (!code) {
    return { code: null, error: 'No se pudo generar el código en la fase de destino.' };
  }

  // `project_id` is filtered too, so a mismatched pair writes nothing even
  // if the checks above were ever bypassed.
  const { error } = await supabase
    .from('tasks')
    .update({ phase_id: targetPhaseId, code })
    .eq('id', taskId)
    .eq('project_id', projectId);

  if (error) return { code: null, error: error.message };

  revalidatePath(`/projects/${projectId}`);
  revalidatePath('/dashboard');
  return { code, error: null };
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
};

export async function createProjectSubtask(
  taskId: number,
  projectId: number,
  data: SubtaskInput,
  assigneeIds: number[]
): Promise<{ id: number | null; error: string | null }> {
  const supabase = await createAuthServerClient();
  const { code, error: codeError } = await allocCode(supabase, 'alloc_subtask_code', { p_task_id: taskId });
  if (codeError) return { id: null, error: codeError };

  const { data: subtask, error } = await supabase
    .from('subtasks')
    .insert({
      ...data,
      task_id: taskId,
      completed: data.status === 'done',
      code,
    })
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
  const activeUser = await getActiveUser();
  if (!activeUser) return { error: 'No autenticado.' };
  if (!canManageTeam(activeUser)) return { error: 'No autorizado.' };

  const supabase = await createAuthServerClient();

  // `subtasks` has no `project_id` of its own — it hangs off `task_id`, so
  // ownership resolves through the parent task, same two-step lookup
  // `moveTaskToPhase` uses instead of relying on a typed join.
  const { data: subtask, error: subtaskError } = await supabase
    .from('subtasks')
    .select('task_id')
    .eq('id', subtaskId)
    .maybeSingle();

  if (subtaskError) return { error: subtaskError.message };
  if (!subtask) return { error: 'La subtarea no existe.' };

  const { data: parentTask, error: taskError } = await supabase
    .from('tasks')
    .select('project_id')
    .eq('id', subtask.task_id)
    .maybeSingle();

  if (taskError) return { error: taskError.message };
  if (!parentTask || parentTask.project_id !== projectId) {
    return { error: 'La subtarea no pertenece a este proyecto.' };
  }

  await syncSubtaskAssignees(supabase, subtaskId, []);

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

  // Etapa 1: los responsables viven en `assignments`, polimórfica. La columna
  // que identifica la fila apuntada es `assignable_id`, no `task_id` ni
  // `subtask_id`, y hay que filtrar por `assignable_type` o se mezclan tareas
  // con subtareas: los dos tipos comparten la tabla y sus ids se pisan.
  const [{ data: taskAssigneeRows }, { data: subtasks }] = await Promise.all([
    supabase
      .from('assignments')
      .select('assignable_id, users(id, name)')
      .eq('assignable_type', 'task')
      .in('assignable_id', taskIds),
    supabase
      .from('subtasks')
      .select('*')
      .in('task_id', taskIds)
      .order('created_at', { ascending: true }),
  ]);

  const subtaskIds = (subtasks ?? []).map((s) => s.id);
  const { data: subtaskAssigneeRows } = subtaskIds.length
    ? await supabase
        .from('assignments')
        .select('assignable_id, users(id, name)')
        .eq('assignable_type', 'subtask')
        .in('assignable_id', subtaskIds)
    : { data: [] };

  // Etapa 1, paso 1B — tres agrupamientos, cada uno indexado una sola vez.
  // Antes eran `.filter()` dentro de `.map()`, que recorrían la lista entera
  // por cada fila.
  const taskAssignees = groupAssignees(taskAssigneeRows);
  const subtaskAssignees = groupAssignees(subtaskAssigneeRows);

  const subtasksByTask = new Map<number, SubtaskWithAssignees[]>();
  for (const subtask of subtasks ?? []) {
    const enriched: SubtaskWithAssignees = {
      ...subtask,
      status: subtask.status ?? 'todo',
      due_date: subtask.due_date ?? null,
      assignees: subtaskAssignees.get(subtask.id) ?? [],
    };

    const list = subtasksByTask.get(subtask.task_id);
    if (list) list.push(enriched);
    else subtasksByTask.set(subtask.task_id, [enriched]);
  }

  return tasks.map((t) => ({
    ...t,
    assignees: taskAssignees.get(t.id) ?? [],
    subtasks: subtasksByTask.get(t.id) ?? [],
  }));
}

// ─────────────────────────────────────────────
// WORK PLAN TREE (Etapa 1, paso 1B)
//
// getProjectTasksFull stays flat and untouched on purpose: previewProjectUpdate
// in project-import-actions.ts walks its result to build the by-code maps, and
// that flow is frozen until update_work_plan lands in Etapa 3. Changing its
// shape would break a consumer that is going to be rewritten anyway.
// ─────────────────────────────────────────────

export async function getProjectWorkPlan(projectId: number): Promise<ProjectWorkPlan> {
  const supabase = createServerClient();

  const [tasks, { data: phaseRows, error: phaseError }] = await Promise.all([
    getProjectTasksFull(projectId),
    supabase
      .from('phases')
      .select('*')
      .eq('project_id', projectId)
      .order('sort_order', { ascending: true }),
  ]);

  // A new table with RLS enabled and no policy returns an empty set — or a
  // permission error that this destructuring used to drop. Either way the
  // project renders as phase-less and nothing on screen says why.
  if (phaseError) {
    console.error('[getProjectWorkPlan] phases query failed:', phaseError.message);
  }

  return buildWorkPlan(phaseRows ?? [], tasks);
}
