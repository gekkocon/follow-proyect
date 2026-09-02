'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient, createAuthServerClient } from './server';
import { getActiveUser, canManageTeam } from './active-user';
import { logActivityChange } from './activity-log';
import type { DbPhase } from './types';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type PhaseInput = {
  name: string;
  objective: string | null;
  status: DbPhase['status'];
  priority: DbPhase['priority'];
  due_date: string | null;
};

// ─────────────────────────────────────────────
// PHASES
// ─────────────────────────────────────────────

/**
 * Etapa 1, paso 1C-b — creates a phase and its human-readable code.
 *
 * Unlike `allocCode` in project-task-actions.ts, a failed allocation ABORTS
 * instead of inserting without a code. That helper returns null and lets the
 * insert omit the key, which is deuda #14: a row can be born code-less in
 * silence. `phases` is a new table and does not inherit that behaviour — a
 * visible error beats an unidentifiable row.
 */
export async function createPhase(
  projectId: number,
  data: PhaseInput
): Promise<{ error: string | null }> {
  const supabase = await createAuthServerClient();

  const { data: code, error: rpcError } = await supabase.rpc('alloc_phase_code', {
    p_project_id: projectId,
  });

  if (rpcError) return { error: rpcError.message };
  if (!code || String(code).trim() === '') {
    return { error: 'No se pudo generar el código de la fase.' };
  }

  // `alloc_phase_code` returns 'F' || integer with no padding (migration 013),
  // so 'F5' -> 5. The suffix is the position the allocator already reserved:
  // deriving sort_order from it keeps both in step without a second counter.
  const sortOrder = Number.parseInt(String(code).slice(1), 10);
  if (!Number.isFinite(sortOrder)) {
    return { error: `No se pudo derivar el orden desde el código ${code}` };
  }

  const { error } = await supabase.from('phases').insert({
    project_id: projectId,
    code,
    name: data.name.trim(),
    objective: data.objective,
    status: data.status,
    priority: data.priority,
    due_date: data.due_date,
    sort_order: sortOrder,
  });

  if (error) return { error: error.message };

  revalidatePath(`/projects/${projectId}`);
  revalidatePath('/dashboard');
  return { error: null };
}

/**
 * Patches the five user-editable columns of a phase.
 *
 * `code`, `sort_order` and `completed_at` are deliberately absent: the code is
 * identity and is never renumbered, sort_order belongs to reordering (out of
 * scope) and completed_at is derived, not typed in.
 *
 * The project_id filter is not redundant with the id one: it keeps a phase of
 * another project from being reachable by passing its id.
 */
export async function updatePhase(
  phaseId: number,
  projectId: number,
  data: PhaseInput
): Promise<{ error: string | null }> {
  const supabase = createServerClient();

  // Etapa 3, paso 1 — read the current status before writing so the log
  // can carry a real old_value. PhaseInput is not partial: every call
  // includes status, whether it changed or not, so a plain "it was sent"
  // check would log a no-op change on every save.
  const { data: existing } = await supabase
    .from('phases')
    .select('status')
    .eq('id', phaseId)
    .maybeSingle();

  const { error } = await supabase
    .from('phases')
    .update({
      name: data.name.trim(),
      objective: data.objective,
      status: data.status,
      priority: data.priority,
      due_date: data.due_date,
    })
    .eq('id', phaseId)
    .eq('project_id', projectId);

  if (error) return { error: error.message };

  if (existing && existing.status !== data.status) {
    await logActivityChange('phase', phaseId, 'status', existing.status, data.status);
  }

  revalidatePath(`/projects/${projectId}`);
  revalidatePath('/dashboard');
  return { error: null };
}

/**
 * Etapa 3, paso 3a — persists a new phase order after a drag & drop.
 *
 * `orderedPhaseIds` is the full list in its new order; sort_order becomes
 * each phase's index in that array. No bulk-update-with-different-values-
 * per-row exists in postgrest-js without an `upsert`, and `upsert` needs
 * every NOT NULL column or it risks clobbering a row with defaults — for
 * a table with `code` as a unique, allocator-owned identity, that's not a
 * risk worth taking to save N-1 round trips.
 *
 * Sequential, not parallel: the loop stops at the first failed update
 * instead of firing every request at once. This is NOT atomicity — there
 * is no transaction, and phases already written before the failure keep
 * their new sort_order. It only bounds how far the inconsistency can
 * spread: a Promise.all would let every in-flight update land regardless
 * of an earlier one failing, so a mid-batch error could leave the order
 * scrambled at any position instead of just from the failure point on.
 * Real fix is a transaction/RPC; this is the deuda 41 stopgap.
 *
 * Every update is scoped to `project_id` too — a phase id from another
 * project cannot be reached by mixing it into the array.
 *
 * On any failure, returns the error and does NOT log — the write did not
 * fully succeed, so there is nothing true to record. `logActivityChange`
 * only runs after every update in the batch confirmed success, same rule
 * as the rest of the Etapa 3 wiring (paso 1).
 */
export async function reorderPhases(
  projectId: number,
  orderedPhaseIds: number[],
  draggedPhaseId: number,
  oldIndex: number,
  newIndex: number
): Promise<{ error: string | null }> {
  const supabase = createServerClient();

  for (let index = 0; index < orderedPhaseIds.length; index++) {
    const { error } = await supabase
      .from('phases')
      .update({ sort_order: index })
      .eq('id', orderedPhaseIds[index])
      .eq('project_id', projectId);
    if (error) return { error: error.message };
  }

  await logActivityChange(
    'phase',
    draggedPhaseId,
    'sort_order',
    String(oldIndex),
    String(newIndex)
  );

  revalidatePath(`/projects/${projectId}`);
  return { error: null };
}

/**
 * Etapa 1, paso 1C-c — deletes an empty phase.
 *
 * D-20: a phase with tasks is not deletable. The way out is moving them with
 * `moveTaskToPhase` (C-1), never detaching them: a detached task keeps its
 * phase-local code and lands in the project orphan namespace, where
 * `idx_tasks_orphan_code` makes it collide.
 *
 * Migration 013d turned `tasks_phase_id_fkey` into ON DELETE RESTRICT, so the
 * database enforces this on its own. The count below is not redundant with it:
 * the constraint raises a raw Postgres message and the contract is a Spanish
 * string. The 23503 branch covers the race where a task lands in the phase
 * between the count and the delete.
 *
 * Unlike `deleteProjectTask`, a null count aborts instead of reading as zero.
 * There, a failed count lets the delete through.
 *
 * The phase code is burned. `projects.phase_code_seq` is PRE and monotonic:
 * deleting F0 does not give F0 back.
 */
export async function deletePhase(
  phaseId: number,
  projectId: number
): Promise<{ error: string | null }> {
  const activeUser = await getActiveUser();
  if (!activeUser) return { error: 'No autenticado.' };
  if (!canManageTeam(activeUser)) return { error: 'No autorizado.' };

  const supabase = await createAuthServerClient();

  const { count, error: countError } = await supabase
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .eq('phase_id', phaseId);

  if (countError) return { error: countError.message };
  if (count === null) {
    return { error: 'No se pudo verificar si la fase tiene tareas. Vuelve a intentarlo.' };
  }
  if (count > 0) {
    return {
      error: `No se puede eliminar una fase con tareas. Tiene ${count}. Muévelas a otra fase primero.`,
    };
  }

  const { error } = await supabase
    .from('phases')
    .delete()
    .eq('id', phaseId)
    .eq('project_id', projectId);

  if (error) {
    if (error.code === '23503') {
      return { error: 'La fase dejó de estar vacía. Recarga la página y vuelve a intentarlo.' };
    }
    return { error: error.message };
  }

  revalidatePath(`/projects/${projectId}`);
  revalidatePath('/dashboard');
  return { error: null };
}
