'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from './server';
import type { DbTask } from './types';

export async function updateTaskStatus(
  id: number,
  status: DbTask['status']
): Promise<{ error: string | null }> {
  const supabase = createServerClient();

  const { error } = await supabase
    .from('tasks')
    .update({
      status,
      // Sync is_blocked flag automatically
      is_blocked: status === 'blocked',
    })
    .eq('id', id);

  if (error) return { error: error.message };

  revalidatePath('/tasks');
  revalidatePath('/dashboard');
  return { error: null };
}
