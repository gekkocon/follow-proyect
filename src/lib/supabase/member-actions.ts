'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from './server';
import type { ProjectMemberWithUser } from './types';

export async function getProjectMembers(projectId: number): Promise<ProjectMemberWithUser[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('project_members')
    .select('*, users(id, name, email, role)')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });

  if (error || !data) return [];
  return data.map((m: { id: number; project_id: number; user_id: number; rol_en_proyecto: string | null; created_at: string; users: ProjectMemberWithUser['user'] }) => ({
    id: m.id,
    project_id: m.project_id,
    user_id: m.user_id,
    rol_en_proyecto: m.rol_en_proyecto,
    created_at: m.created_at,
    user: m.users,
  }));
}

/**
 * Returns null for global admins (see all projects).
 * Returns an array of project IDs for non-admins.
 */
export async function getVisibleProjectIds(
  userId: number,
  isAdmin: boolean
): Promise<number[] | null> {
  if (isAdmin) return null;
  const supabase = createServerClient();
  const { data } = await supabase
    .from('project_members')
    .select('project_id')
    .eq('user_id', userId);
  return (data ?? []).map((m: { project_id: number }) => m.project_id);
}

export async function addProjectMember(
  projectId: number,
  userId: number,
  role?: string | null
): Promise<{ error: string | null }> {
  const supabase = createServerClient();
  const { error } = await supabase.from('project_members').insert({
    project_id: projectId,
    user_id: userId,
    rol_en_proyecto: role || null,
  });
  if (error) return { error: error.message };
  revalidatePath(`/projects/${projectId}`);
  return { error: null };
}

export async function updateMemberRole(
  memberId: number,
  projectId: number,
  role: string | null
): Promise<{ error: string | null }> {
  const supabase = createServerClient();
  const { error } = await supabase
    .from('project_members')
    .update({ rol_en_proyecto: role })
    .eq('id', memberId);
  if (error) return { error: error.message };
  revalidatePath(`/projects/${projectId}`);
  return { error: null };
}

export async function removeProjectMember(
  memberId: number,
  projectId: number
): Promise<{ error: string | null }> {
  const supabase = createServerClient();
  const { error } = await supabase.from('project_members').delete().eq('id', memberId);
  if (error) return { error: error.message };
  revalidatePath(`/projects/${projectId}`);
  return { error: null };
}
