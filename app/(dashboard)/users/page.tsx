import { createServerClient } from '@/src/lib/supabase/server';
import { UsersClient } from '@/components/users/UsersClient';
import type { UserWithCounts } from '@/src/lib/supabase/user-actions';

async function getUsersData(): Promise<{
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
    task_count:    (tasks    ?? []).filter((t) => t.assignee_id === u.id).length,
    project_count: (projects ?? []).filter((p) => p.owner_id    === u.id).length,
  }));

  return { users: usersWithCounts, error: null };
}

export default async function UsersPage() {
  const { users, error } = await getUsersData();
  return <UsersClient initialUsers={users} error={error} />;
}
