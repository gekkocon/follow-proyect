import { getSessionUser } from './auth';
import type { DbUser } from './types';

export type ActiveUser = {
  id: number;
  role: DbUser['role'];
};

/**
 * Returns the active user's id and role from the real Supabase Auth session.
 * Looks up the `users` table by email from the Auth session.
 * Returns null if there is no active session (middleware should prevent this).
 */
export async function getActiveUser(): Promise<ActiveUser | null> {
  const user = await getSessionUser();
  if (!user) return null;
  return { id: user.id, role: user.role };
}

/** Admins and PMs can manage project teams */
export function canManageTeam(user: ActiveUser): boolean {
  return user.role === 'admin' || user.role === 'pm';
}

/** Admins see all projects; others only see projects where they're a member */
export function isGlobalAdmin(user: ActiveUser): boolean {
  return user.role === 'admin';
}
