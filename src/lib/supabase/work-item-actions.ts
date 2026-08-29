'use server';

import { revalidatePath } from 'next/cache';
import { createAuthServerClient } from '@/src/lib/supabase/server';
import { getActiveUser, canManageTeam, isGlobalAdmin } from '@/src/lib/supabase/active-user';
import { getVisibleProjectIds } from '@/src/lib/supabase/member-actions';
import {
  createWorkItemSchema,
  updateWorkItemSchema,
  type CreateWorkItemInput,
  type UpdateWorkItemInput,
} from '@/src/lib/supabase/work-item-schema';

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

  const { origin_type, origin_id, ...fields } = data;

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
  const { id, ...fields } = parsed.data;

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
