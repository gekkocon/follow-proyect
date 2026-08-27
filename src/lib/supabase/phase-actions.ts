'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from './server';
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
  const supabase = createServerClient();

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

  revalidatePath(`/projects/${projectId}`);
  revalidatePath('/dashboard');
  return { error: null };
}
