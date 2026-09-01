'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from './server';
import { logActivityChange } from './activity-log';
import type { DbTask } from './types';

export async function updateTaskStatus(
  id: number,
  status: DbTask['status']
): Promise<{ error: string | null }> {
  const supabase = createServerClient();

  // Etapa 3, paso 1 — separate write path from updateProjectTask (global
  // /tasks view instead of a project's detail page), so it needs its own
  // audit read. is_blocked is derived from status here, not sent
  // separately, so the old value is derivable from the old status alone.
  const { data: existing } = await supabase
    .from('tasks')
    .select('status, is_blocked')
    .eq('id', id)
    .maybeSingle();

  const isBlocked = status === 'blocked';

  const { error } = await supabase
    .from('tasks')
    .update({
      status,
      // Sync is_blocked flag automatically
      is_blocked: isBlocked,
    })
    .eq('id', id);

  if (error) return { error: error.message };

  if (existing) {
    if (existing.status !== status) {
      await logActivityChange('task', id, 'status', existing.status, status);
    }
    if (existing.is_blocked !== isBlocked) {
      await logActivityChange('task', id, 'is_blocked', existing.is_blocked, isBlocked);
    }
  }

  revalidatePath('/tasks');
  revalidatePath('/dashboard');
  return { error: null };
}
