import { createServerClient } from '@/src/lib/supabase/server';
import { UsersClient } from '@/components/users/UsersClient';
import type { UserWithCounts } from '@/src/lib/supabase/user-actions';

async function getUsersData(): Promise<{
  users: UserWithCounts[];
  error: string | null;
}> {
  const supabase = createServerClient();

  const [{ data: users, error }, { data: taskAssignees }, { data: projects }] =
    await Promise.all([
      supabase.from('users').select('*').order('name'),
      // Filtro por assignable_type obligatorio: sin él el contador sumaría
      // subtareas y work_items al total de tareas del usuario.
      supabase
        .from('assignments')
        .select('assignable_id, user_id')
        .eq('assignable_type', 'task'),
      supabase.from('projects').select('id, owner_id'),
    ]);

  if (error) return { users: [], error: error.message };

  const usersWithCounts: UserWithCounts[] = (users ?? []).map((u) => ({
    ...u,
    task_count:    (taskAssignees ?? []).filter((ta) => ta.user_id === u.id).length,
    project_count: (projects      ?? []).filter((p)  => p.owner_id === u.id).length,
  }));

  return { users: usersWithCounts, error: null };
}

export default async function UsersPage() {
  const { users, error } = await getUsersData();
  return <UsersClient initialUsers={users} error={error} />;
}
