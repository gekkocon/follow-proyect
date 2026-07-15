import { createServerClient } from '@/src/lib/supabase/server';
import { ProjectsClient } from '@/components/projects/ProjectsClient';
import { getActiveUser, isGlobalAdmin } from '@/src/lib/supabase/active-user';
import { getVisibleProjectIds } from '@/src/lib/supabase/member-actions';
import type { ProjectWithRelations, DbUser } from '@/src/lib/supabase/types';

async function getPageData(): Promise<{
  projects: ProjectWithRelations[];
  users: DbUser[];
  error: string | null;
}> {
  const supabase = createServerClient();
  const activeUser = await getActiveUser();
  if (!activeUser) return { projects: [], users: [], error: null };
  const visibleIds = await getVisibleProjectIds(activeUser.id, isGlobalAdmin(activeUser));

  let query = supabase.from('projects').select('*').order('created_at', { ascending: false });
  if (visibleIds !== null) {
    query = query.in('id', visibleIds.length ? visibleIds : [-1]);
  }

  const { data: projects, error } = await query;

  // Surface errors instead of swallowing them
  if (error) return { projects: [], users: [], error: error.message };
  if (!projects || projects.length === 0) {
    // Still try to fetch users for the "create" form
    const { data: allUsers } = await supabase
      .from('users')
      .select('*')
      .eq('status', 'active')
      .order('name');
    return { projects: [], users: allUsers ?? [], error: null };
  }

  const ownerIds = Array.from(
    new Set(projects.map((p) => p.owner_id).filter(Boolean))
  ) as number[];
  const projectIds = projects.map((p) => p.id);

  const [{ data: ownerData }, { data: tasksData }, { data: allUsers }] =
    await Promise.all([
      supabase
        .from('users')
        .select('id, name, email, role, status, created_at, updated_at')
        .in('id', ownerIds.length ? ownerIds : [0]),
      supabase
        .from('tasks')
        .select('id, project_id, status')
        .in('project_id', projectIds.length ? projectIds : [0]),
      supabase.from('users').select('*').eq('status', 'active').order('name'),
    ]);

  const projectsWithRelations: ProjectWithRelations[] = projects.map((p) => ({
    ...p,
    owner: ownerData?.find((u) => u.id === p.owner_id) ?? null,
    tasks: (tasksData ?? []).filter((t) => t.project_id === p.id),
  }));

  return {
    projects: projectsWithRelations,
    users: allUsers ?? [],
    error: null,
  };
}

export default async function ProjectsPage() {
  const { projects, users, error } = await getPageData();

  return (
    <ProjectsClient
      initialProjects={projects}
      users={users}
      error={error}
    />
  );
}
