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

// Fase 7: start_date, estimated_cost, dependencies added for bulk import
// Fase 8A: `code` — human-readable identity (F0, F1, …), unique per project.
// Never renumbered on reorder or delete; burned codes are not reused.
// Nullable only for rows created before migration 010.
export type DbTask = {
  id: number;
  code: string | null;
  title: string;
  description: string | null;
  status: 'todo' | 'in_progress' | 'in_review' | 'done' | 'blocked';
  priority: 'low' | 'medium' | 'high' | 'critical';
  project_id: number | null;
  // Etapa 1 (migración 013): la tarea cuelga de una fase. Nullable mientras
  // convivan las tareas anteriores a la migración.
  phase_id: number | null;
  // Código anterior a la Etapa 1, conservado para poder rastrear una fila
  // cuyo `code` se recompuso.
  legacy_code: string | null;
  completed_at: string | null;
  is_blocked: boolean;
  blocked_reason: string | null;
  start_date: string | null;
  due_date: string | null;
  estimated_cost: number | null;
  dependencies: number[];
  created_at: string;
  updated_at: string;
};

// Fase 5E: subtasks extended with status and due_date
// Fase 6B+: priority added
// Fase 7: description, start_date, estimated_cost, dependencies added for bulk import
// Fase 8A: `code` — human-readable identity derived from the parent task
// (F0-T01, F0-T02, …). Same identity/burn rules as DbTask['code'].
export type DbSubtask = {
  id: number;
  code: string | null;
  title: string;
  description: string | null;
  completed: boolean;
  status: 'todo' | 'in_progress' | 'in_review' | 'done' | 'blocked';
  priority: 'low' | 'medium' | 'high' | 'critical';
  start_date: string | null;
  due_date: string | null;
  estimated_cost: number | null;
  dependencies: number[];
  task_id: number;
  // Etapa 1 (migración 013): mismo criterio que en DbTask.
  legacy_code: string | null;
  completed_at: string | null;
  created_at: string;
};

// Etapa 1 (migración 013): las fases del plan de trabajo. Una tarea cuelga
// de una fase, y la fase lleva su propio contador de códigos de tarea.
export type DbPhase = {
  id: number;
  project_id: number;
  code: string;
  name: string;
  objective: string | null;
  status: 'todo' | 'in_progress' | 'in_review' | 'done' | 'blocked';
  priority: 'low' | 'medium' | 'high' | 'critical';
  start_date: string | null;
  due_date: string | null;
  completed_at: string | null;
  sort_order: number;
  created_at: string;
  task_code_seq: number;
};

// Etapa 1 (migración 013): tabla única de responsables, polimórfica. Reemplaza
// a task_assignees y subtask_assignees, que se borran en la 014.
export type DbAssignment = {
  id: number;
  assignable_type: 'task' | 'subtask' | 'work_item';
  assignable_id: number;
  user_id: number;
  created_at: string;
};

// Fase 5E: join tables for multiple assignees.
// SUPERSEDIDAS por DbAssignment. Se conservan porque los DELETE siguen
// alcanzando las tablas viejas hasta la migración 014.
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

export type TaskWithRelations = DbTask & {
  project: Pick<DbProject, 'id' | 'name'> | null;
};

// Fase 5E: full relations with multiple assignees
export type SubtaskWithAssignees = DbSubtask & {
  assignees: Pick<DbUser, 'id' | 'name'>[];
};

export type TaskWithFullRelations = DbTask & {
  assignees: Pick<DbUser, 'id' | 'name'>[];
  subtasks: SubtaskWithAssignees[];
};

// Etapa 2 (migración 015): bugs / deuda técnica / question_rfc, unificados
// en una sola tabla. `type` decide qué campos específicos aplican; los de
// los otros dos tipos quedan en null. Mismo criterio que DbTask/DbSubtask:
// una fila plana, no una unión discriminada, porque así vuelve de Supabase.
export type WorkItemType = 'bug' | 'debt' | 'question_rfc';
export type WorkItemStatus =
  | 'open'
  | 'in_progress'
  | 'awaiting_decision'
  | 'resolved'
  | 'discarded';
export type WorkItemSeverity = 'minor' | 'major' | 'blocker';
export type WorkItemImpact = 'low' | 'medium' | 'high';

// Mismo formato que se documentó para subtasks.checklist en
// ARQUITECTURA-WORKPLAN.md — nunca implementado ahí, primero implementado
// acá para work_items. Sin reordenar en este ciclo: `order` se asigna una
// vez al crear el ítem y no se vuelve a tocar.
export type ChecklistItem = {
  id: string;
  text: string;
  done: boolean;
  order: number;
};

export type DbWorkItem = {
  id: number;
  project_id: number;
  type: WorkItemType;
  code: string;
  title: string;
  description: string | null;
  status: WorkItemStatus;
  priority: 'low' | 'medium' | 'high' | 'critical';
  created_by: number | null;
  created_at: string;
  resolved_at: string | null;
  sort_order: number;
  generated_task_id: number | null;
  checklist: ChecklistItem[];

  // Específicos de bug — null si type !== 'bug'.
  severity: WorkItemSeverity | null;
  environment: string | null;
  version: string | null;
  reproduction_steps: string | null;
  expected_behavior: string | null;
  actual_behavior: string | null;
  resolution: string | null;

  // Específicos de debt — null si type !== 'debt'.
  impact: WorkItemImpact | null;
  proposed_solution: string | null;
  estimated_effort: string | null;
  target_phase_id: number | null;

  // Específicos de question_rfc — null si type !== 'question_rfc'.
  options: string[] | null;
  recommendation: string | null;
  final_decision: string | null;
};

export type WorkItemWithAssignees = DbWorkItem & {
  assignees: Pick<DbUser, 'id' | 'name'>[];
};

// Etapa 2, sesión 1M: vínculo opcional de un work item hacia dónde
// apareció (fase/tarea/subtarea). `origin_type` es TEXT + CHECK en la
// base, no un enum Postgres real (ver ARQUITECTURA-WORKPLAN.md,
// sección `work_item_origins`) — igual que `assignments.assignable_type`.
export type WorkItemOriginType = 'phase' | 'task' | 'subtask';

export type DbWorkItemOrigin = {
  id: number;
  work_item_id: number;
  origin_type: WorkItemOriginType;
  origin_id: number;
  created_at: string;
};

export type WorkItemWithOrigins = WorkItemWithAssignees & {
  origins: Pick<DbWorkItemOrigin, 'id' | 'origin_type' | 'origin_id'>[];
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
