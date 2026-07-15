'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient, createAdminClient } from './server';
import type { DbUser } from './types';

export type UserFormValues = {
  name: string;
  email: string;
  role: DbUser['role'];
  status: DbUser['status'];
  password?: string;
};

export type UserWithCounts = DbUser & {
  task_count: number;
  project_count: number;
};

export async function fetchUsers(): Promise<{
  users: UserWithCounts[];
  error: string | null;
}> {
  const supabase = createServerClient();

  const [{ data: users, error }, { data: tasks }, { data: projects }] =
    await Promise.all([
      supabase.from('users').select('*').order('name'),
      supabase.from('tasks').select('id, assignee_id'),
      supabase.from('projects').select('id, owner_id'),
    ]);

  if (error) return { users: [], error: error.message };

  const usersWithCounts: UserWithCounts[] = (users ?? []).map((u) => ({
    ...u,
    task_count: (tasks ?? []).filter((t) => t.assignee_id === u.id).length,
    project_count: (projects ?? []).filter((p) => p.owner_id === u.id).length,
  }));

  return { users: usersWithCounts, error: null };
}

export async function createUser(
  values: UserFormValues
): Promise<{ error: string | null }> {
  if (!values.password) {
    return { error: 'La contraseña es requerida para crear un usuario.' };
  }

  const admin = createAdminClient();

  // 1. Create Supabase Auth account (no email confirmation required with service role key)
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: values.email.trim().toLowerCase(),
    password: values.password,
    email_confirm: true,
  });

  if (authError) {
    if (authError.message.includes('already registered') || authError.message.includes('already been registered')) {
      return { error: 'Ya existe una cuenta con ese email.' };
    }
    return { error: authError.message };
  }

  // 2. Insert into the `users` table
  const supabase = createServerClient();
  const { error: dbError } = await supabase.from('users').insert({
    name:   values.name.trim(),
    email:  values.email.trim().toLowerCase(),
    role:   values.role,
    status: values.status,
  });

  if (dbError) {
    // Roll back Auth user if DB insert fails
    await admin.auth.admin.deleteUser(authData.user.id);
    return { error: dbError.message };
  }

  revalidatePath('/users');
  return { error: null };
}

export async function updateUser(
  id: number,
  values: UserFormValues
): Promise<{ error: string | null }> {
  const supabase = createServerClient();
  const newEmail = values.email.trim().toLowerCase();

  // Fetch current email to detect if it changed
  const { data: current } = await supabase
    .from('users')
    .select('email')
    .eq('id', id)
    .single();

  // If email changed, update it in Supabase Auth too
  if (current && current.email !== newEmail) {
    const admin = createAdminClient();

    // Look up the Auth user by current email
    const { data: authList } = await admin.auth.admin.listUsers();
    const authUser = authList?.users.find((u) => u.email === current.email);

    if (authUser) {
      const { error: authError } = await admin.auth.admin.updateUserById(
        authUser.id,
        { email: newEmail }
      );
      if (authError) {
        if (authError.message.toLowerCase().includes('already')) {
          return { error: 'Ya existe una cuenta con ese email.' };
        }
        return { error: authError.message };
      }
    }
  }

  const { error } = await supabase
    .from('users')
    .update({
      name:   values.name.trim(),
      email:  newEmail,
      role:   values.role,
      status: values.status,
    })
    .eq('id', id);

  if (error) return { error: error.message };
  revalidatePath('/users');
  revalidatePath('/projects');
  revalidatePath('/tasks');
  return { error: null };
}

export async function updateUserRole(
  id: number,
  role: DbUser['role']
): Promise<{ error: string | null }> {
  const supabase = createServerClient();
  const { error } = await supabase.from('users').update({ role }).eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/users');
  return { error: null };
}

export async function updateUserStatus(
  id: number,
  status: DbUser['status']
): Promise<{ error: string | null }> {
  const supabase = createServerClient();
  const { error } = await supabase.from('users').update({ status }).eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/users');
  revalidatePath('/tasks');
  return { error: null };
}

export async function deleteUser(
  id: number
): Promise<{ error: string | null; blockedBy?: string }> {
  const supabase = createServerClient();

  const [{ data: tasks }, { data: projects }] = await Promise.all([
    supabase.from('tasks').select('id').eq('assignee_id', id).limit(1),
    supabase.from('projects').select('id').eq('owner_id', id).limit(1),
  ]);

  if (tasks && tasks.length > 0) {
    return {
      error: 'Este usuario tiene tareas asignadas. Reasigna las tareas antes de eliminarlo.',
      blockedBy: 'tasks',
    };
  }
  if (projects && projects.length > 0) {
    return {
      error: 'Este usuario es dueño de proyectos. Reasigna los proyectos antes de eliminarlo.',
      blockedBy: 'projects',
    };
  }

  const { error } = await supabase.from('users').delete().eq('id', id);
  if (error) return { error: error.message };

  revalidatePath('/users');
  return { error: null };
}
