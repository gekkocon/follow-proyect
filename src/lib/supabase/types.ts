// Manual types matching the Supabase tables created in Fase 1.
// TODO: Replace with auto-generated types via:
//   npx supabase gen types typescript --project-id <ref> > src/lib/supabase/database.types.ts

export type DbUser = {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'pm' | 'developer' | 'designer';
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
};

export type DbProject = {
  id: number;
  name: string;
  description: string | null;
  status: 'planning' | 'active' | 'on_hold' | 'completed' | 'overdue';
  priority: 'low' | 'medium' | 'high' | 'critical';
  owner_id: number | null;
  start_date: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
};

export type DbTask = {
  id: number;
  title: string;
  description: string | null;
  status: 'todo' | 'in_progress' | 'in_review' | 'done' | 'blocked';
  priority: 'low' | 'medium' | 'high' | 'critical';
  project_id: number | null;
  assignee_id: number | null;
  is_blocked: boolean;
  blocked_reason: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
};

// Fase 5E: subtasks extended with status and due_date
export type DbSubtask = {
  id: number;
  title: string;
  completed: boolean;
  status: 'todo' | 'in_progress' | 'in_review' | 'done' | 'blocked';
  due_date: string | null;
  task_id: number;
  created_at: string;
};

// Fase 5E: join tables for multiple assignees
export type DbTaskAssignee = {
  id: number;
  task_id: number;
  user_id: number;
  created_at: string;
};

export type DbSubtaskAssignee = {
  id: number;
  subtask_id: number;
  user_id: number;
  created_at: string;
};

// Enriched types for UI
export type ProjectWithRelations = DbProject & {
  owner: DbUser | null;
  tasks: Pick<DbTask, 'id' | 'status'>[];
};

// Legacy single-assignee type (used by global tasks view)
export type TaskWithSubtasks = DbTask & {
  assignee: DbUser | null;
  subtasks: DbSubtask[];
};

export type TaskWithRelations = DbTask & {
  project: Pick<DbProject, 'id' | 'name'> | null;
  assignee: Pick<DbUser, 'id' | 'name'> | null;
};

// Fase 5E: full relations with multiple assignees
export type SubtaskWithAssignees = DbSubtask & {
  assignees: Pick<DbUser, 'id' | 'name'>[];
};

export type TaskWithFullRelations = DbTask & {
  assignees: Pick<DbUser, 'id' | 'name'>[];
  subtasks: SubtaskWithAssignees[];
};

// Fase 5F: project members
export type DbProjectMember = {
  id: number;
  project_id: number;
  user_id: number;
  rol_en_proyecto: string | null;
  created_at: string;
};

export type ProjectMemberWithUser = DbProjectMember & {
  user: Pick<DbUser, 'id' | 'name' | 'email' | 'role'>;
};
