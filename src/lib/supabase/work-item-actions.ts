'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient, createAuthServerClient } from '@/src/lib/supabase/server';
import { getActiveUser, canManageTeam, isGlobalAdmin } from '@/src/lib/supabase/active-user';
import { getVisibleProjectIds } from '@/src/lib/supabase/member-actions';
import {
  createWorkItemSchema,
  updateWorkItemSchema,
  type CreateWorkItemInput,
  type UpdateWorkItemInput,
} from '@/src/lib/supabase/work-item-schema';
import type { DbUser, WorkItemWithOrigins, WorkItemOriginType } from '@/src/lib/supabase/types';

// -----------------------------------------------------------------
// syncWorkItemAssignees
// -----------------------------------------------------------------
// Same pattern as syncTaskAssignees/syncSubtaskAssignees in
// project-task-actions.ts, filtered by assignable_type='work_item'.
// No legacy table to clean up here — work_items is new and never had
// a work_item_assignees table of its own.
async function syncWorkItemAssignees(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  workItemId: number,
  assigneeIds: number[]
) {
  await supabase
    .from('assignments')
    .delete()
    .eq('assignable_type', 'work_item')
    .eq('assignable_id', workItemId);

  if (assigneeIds.length) {
    await supabase.from('assignments').insert(
      assigneeIds.map((uid) => ({
        assignable_type: 'work_item',
        assignable_id: workItemId,
        user_id: uid,
      }))
    );
  }
}

// -----------------------------------------------------------------
// createWorkItem
// -----------------------------------------------------------------
// Authorization lives inside alloc_work_item_code (SQL, SECURITY
// INVOKER, verified session 1K): admin passes, everyone else needs a
// row in project_members. This action does not duplicate that check —
// it relies on the RPC to fail closed with 42501 for non-members, the
// same abort-on-visible-error pattern already used for phase/task/
// subtask allocation (see deuda 33 en CLAUDE.md).
export async function createWorkItem(
  input: CreateWorkItemInput
): Promise<{ error: string | null }> {
  const parsed = createWorkItemSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos.' };
  }
  const data = parsed.data;

  const activeUser = await getActiveUser();
  if (!activeUser) {
    return { error: 'No autorizado.' };
  }

  // createAuthServerClient() is mandatory here: it's the only client
  // that propagates the session JWT to Postgres. createServerClient()
  // (anon) would make alloc_work_item_code fail with 42501 even for a
  // legitimate member, because request.jwt.claims would be empty.
  const supabase = await createAuthServerClient();

  const { data: code, error: rpcError } = await supabase.rpc('alloc_work_item_code', {
    p_project_id: data.project_id,
    p_type: data.type,
  });

  if (rpcError || !code) {
    // Abort on visible error — do not insert a codeless row (deuda 33).
    return { error: rpcError?.message ?? 'No se pudo generar el código.' };
  }

  const { origin_type, origin_id, assigneeIds, ...fields } = data;

  const { data: inserted, error: insertError } = await supabase
    .from('work_items')
    .insert({
      ...fields,
      code,
      created_by: activeUser.id,
    })
    .select('id')
    .single();

  if (insertError || !inserted) {
    return { error: insertError?.message ?? 'No se pudo crear el registro.' };
  }

  await syncWorkItemAssignees(supabase, inserted.id, assigneeIds);

  if (origin_type && origin_id) {
    const { error: originError } = await supabase.from('work_item_origins').insert({
      work_item_id: inserted.id,
      origin_type,
      origin_id,
    });
    // Origin is metadata, not the core record — surface it but the
    // work item itself is already created and valid without it.
    if (originError) {
      return { error: `Work item creado (${code}), pero falló el vínculo de origen: ${originError.message}` };
    }
  }

  revalidatePath(`/projects/${data.project_id}`);
  return { error: null };
}

// -----------------------------------------------------------------
// updateWorkItem
// -----------------------------------------------------------------
// Any project member can edit. Reuses getVisibleProjectIds() instead
// of a new membership query — same function that already gates page
// listings, avoids a second source of truth for "is this user allowed
// to see/touch this project" (deuda 4 lesson: duplicated logic rots).
export async function updateWorkItem(
  input: UpdateWorkItemInput
): Promise<{ error: string | null }> {
  const parsed = updateWorkItemSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos.' };
  }
  const { id, assigneeIds, ...fields } = parsed.data;

  const activeUser = await getActiveUser();
  if (!activeUser) {
    return { error: 'No autorizado.' };
  }

  const supabase = await createAuthServerClient();

  const { data: existing, error: fetchError } = await supabase
    .from('work_items')
    .select('project_id')
    .eq('id', id)
    .single();

  if (fetchError || !existing) {
    return { error: 'Work item no encontrado.' };
  }

  const visibleIds = await getVisibleProjectIds(activeUser.id, isGlobalAdmin(activeUser));
  const isMember = visibleIds === null || visibleIds.includes(existing.project_id);
  if (!isMember) {
    return { error: 'No autorizado.' };
  }

  const { error: updateError } = await supabase
    .from('work_items')
    .update(fields)
    .eq('id', id);

  if (updateError) {
    return { error: updateError.message };
  }

  await syncWorkItemAssignees(supabase, id, assigneeIds);

  revalidatePath(`/projects/${existing.project_id}`);
  return { error: null };
}

// -----------------------------------------------------------------
// deleteWorkItem
// -----------------------------------------------------------------
// Destructive — gated by canManageTeam() (admin o pm), same pattern
// as the other operational deletes closed in 1H (deuda 17).
export async function deleteWorkItem(id: number): Promise<{ error: string | null }> {
  const activeUser = await getActiveUser();
  if (!activeUser || !canManageTeam(activeUser)) {
    return { error: 'No autorizado.' };
  }

  const supabase = await createAuthServerClient();

  const { data: existing, error: fetchError } = await supabase
    .from('work_items')
    .select('project_id')
    .eq('id', id)
    .single();

  if (fetchError || !existing) {
    return { error: 'Work item no encontrado.' };
  }

  const { error: deleteError } = await supabase.from('work_items').delete().eq('id', id);

  if (deleteError) {
    return { error: deleteError.message };
  }

  revalidatePath(`/projects/${existing.project_id}`);
  return { error: null };
}

// -----------------------------------------------------------------
// getProjectWorkItems
// -----------------------------------------------------------------
// Read-only, no session needed — same reasoning as getProjectTasksFull:
// RLS is disabled on work_items (migration 015 never enabled it, same
// posture as tasks/phases/assignments), so the anon client is enough.
//
// Etapa 2, sesión 1M — return shape changed from a bare array to
// { items, originCounts }: originCounts is aggregate data (how many
// items reference a given task/subtask), it cannot live per-item. Both
// call sites (page.tsx, WorkItemsSection.refresh()) were updated for
// this. Each item's `origins` carries the raw rows (including each
// row's own id, required by removeWorkItemOrigin) — the human-readable
// label is composed once on the client, against `originOptions`, not
// duplicated here.
export async function getProjectWorkItems(projectId: number): Promise<{
  items: WorkItemWithOrigins[];
  originCounts: Record<string, number>;
}> {
  const supabase = createServerClient();

  const { data: items } = await supabase
    .from('work_items')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });

  if (!items?.length) return { items: [], originCounts: {} };

  const itemIds = items.map((i) => i.id);

  const [{ data: assigneeRows }, { data: originRows }] = await Promise.all([
    supabase
      .from('assignments')
      .select('assignable_id, users(id, name)')
      .eq('assignable_type', 'work_item')
      .in('assignable_id', itemIds),
    supabase
      .from('work_item_origins')
      .select('id, work_item_id, origin_type, origin_id')
      .in('work_item_id', itemIds),
  ]);

  const assigneesByItem = new Map<number, Pick<DbUser, 'id' | 'name'>[]>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const row of (assigneeRows ?? []) as any[]) {
    const user = row?.users as Pick<DbUser, 'id' | 'name'> | null | undefined;
    if (!user) continue;
    const list = assigneesByItem.get(row.assignable_id);
    if (list) list.push(user);
    else assigneesByItem.set(row.assignable_id, [user]);
  }

  type OriginRow = { id: number; origin_type: WorkItemOriginType; origin_id: number };
  const originsByItem = new Map<number, OriginRow[]>();
  const originCounts: Record<string, number> = {};
  for (const row of originRows ?? []) {
    const entry: OriginRow = { id: row.id, origin_type: row.origin_type, origin_id: row.origin_id };
    const list = originsByItem.get(row.work_item_id);
    if (list) list.push(entry);
    else originsByItem.set(row.work_item_id, [entry]);

    const key = `${row.origin_type}:${row.origin_id}`;
    originCounts[key] = (originCounts[key] ?? 0) + 1;
  }

  const withRelations: WorkItemWithOrigins[] = items.map((item) => ({
    ...item,
    assignees: assigneesByItem.get(item.id) ?? [],
    origins: originsByItem.get(item.id) ?? [],
  }));

  return { items: withRelations, originCounts };
}

// -----------------------------------------------------------------
// addWorkItemOrigin / removeWorkItemOrigin
// -----------------------------------------------------------------
// Same gate as updateWorkItem — any project member. No new
// authorization helper: reuses getVisibleProjectIds() exactly like
// updateWorkItem does, for the same "one source of truth" reason
// (deuda 4 lesson, already cited there).
export async function addWorkItemOrigin(
  workItemId: number,
  originType: 'task' | 'subtask',
  originId: number
): Promise<{ error: string | null }> {
  const activeUser = await getActiveUser();
  if (!activeUser) {
    return { error: 'No autorizado.' };
  }

  const supabase = await createAuthServerClient();

  const { data: workItem, error: workItemError } = await supabase
    .from('work_items')
    .select('project_id')
    .eq('id', workItemId)
    .maybeSingle();

  if (workItemError || !workItem) {
    return { error: 'Work item no encontrado.' };
  }

  const visibleIds = await getVisibleProjectIds(activeUser.id, isGlobalAdmin(activeUser));
  const isMember = visibleIds === null || visibleIds.includes(workItem.project_id);
  if (!isMember) {
    return { error: 'No autorizado.' };
  }

  // Resolve the origin's own project_id to confirm it belongs to the same
  // project as the work item. Subtasks have no project_id column of
  // their own — same two-step lookup deleteProjectSubtask already uses
  // via task_id -> tasks.project_id.
  let originProjectId: number | null = null;
  if (originType === 'task') {
    const { data: task } = await supabase
      .from('tasks')
      .select('project_id')
      .eq('id', originId)
      .maybeSingle();
    originProjectId = task?.project_id ?? null;
  } else {
    const { data: subtask } = await supabase
      .from('subtasks')
      .select('task_id')
      .eq('id', originId)
      .maybeSingle();
    if (subtask) {
      const { data: parentTask } = await supabase
        .from('tasks')
        .select('project_id')
        .eq('id', subtask.task_id)
        .maybeSingle();
      originProjectId = parentTask?.project_id ?? null;
    }
  }

  if (originProjectId === null || originProjectId !== workItem.project_id) {
    return { error: 'El origen no pertenece a este proyecto.' };
  }

  const { error: insertError } = await supabase.from('work_item_origins').insert({
    work_item_id: workItemId,
    origin_type: originType,
    origin_id: originId,
  });

  if (insertError) {
    return { error: insertError.message };
  }

  revalidatePath(`/projects/${workItem.project_id}`);
  return { error: null };
}

export async function removeWorkItemOrigin(workItemOriginId: number): Promise<{ error: string | null }> {
  const activeUser = await getActiveUser();
  if (!activeUser) {
    return { error: 'No autorizado.' };
  }

  const supabase = await createAuthServerClient();

  const { data: origin, error: fetchError } = await supabase
    .from('work_item_origins')
    .select('id, work_item_id')
    .eq('id', workItemOriginId)
    .maybeSingle();

  if (fetchError || !origin) {
    return { error: 'Origen no encontrado.' };
  }

  const { data: workItem, error: workItemError } = await supabase
    .from('work_items')
    .select('project_id')
    .eq('id', origin.work_item_id)
    .maybeSingle();

  if (workItemError || !workItem) {
    return { error: 'Work item no encontrado.' };
  }

  const visibleIds = await getVisibleProjectIds(activeUser.id, isGlobalAdmin(activeUser));
  const isMember = visibleIds === null || visibleIds.includes(workItem.project_id);
  if (!isMember) {
    return { error: 'No autorizado.' };
  }

  const { error: deleteError } = await supabase
    .from('work_item_origins')
    .delete()
    .eq('id', workItemOriginId);

  if (deleteError) {
    return { error: deleteError.message };
  }

  revalidatePath(`/projects/${workItem.project_id}`);
  return { error: null };
}
