'use server';

import { createAuthServerClient } from './server';
import type { DbUser } from './types';

export type SessionUser = {
  id: number;
  name: string;
  email: string;
  role: DbUser['role'];
};

/** Returns the Supabase Auth session, or null if not authenticated. */
export async function getSession() {
  const supabase = await createAuthServerClient();
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

/** Returns the authenticated user's record from the `users` table, or null. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createAuthServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;

  const db = (await import('./server')).createServerClient();
  const { data } = await db
    .from('users')
    .select('id, name, email, role')
    .eq('email', user.email)
    .single();

  return data ?? null;
}

/** Signs in with email + password. Returns error string or null on success. */
export async function signIn(
  email: string,
  password: string
): Promise<{ error: string | null }> {
  const supabase = await createAuthServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };
  return { error: null };
}

/** Signs out the current user. */
export async function signOut(): Promise<void> {
  const supabase = await createAuthServerClient();
  await supabase.auth.signOut();
}
