// ---------------------------------------------------------------------------
// Etapa 1, paso 1B — Pure helpers for the Work Plan tree.
//
// Lives outside project-task-actions.ts because that file carries 'use server'
// and a server-actions module can only export async functions. Same reason
// update-normalize.ts exists. There is no database access here: only code
// composition, ordering and arithmetic, so the Server Component and the Client
// Component call the same functions over the same data and cannot drift apart.
// ---------------------------------------------------------------------------

import type { DbPhase, TaskWithFullRelations } from '@/src/lib/supabase/types';

// ---------------------------------------------------------------------------
// Human-readable codes
// ---------------------------------------------------------------------------

/**
 * Builds the composite code shown on screen out of the local codes stored in
 * the database: F0 + T03 + S02 -> "F0-T03-S02".
 *
 * `own` is the leaf and carries the identity. When it is missing there is
 * nothing to label and the function returns null so the caller hides the badge.
 * Returning only the ancestors would print "F0" beside a task, which reads as
 * the phase's own code — worse than printing nothing.
 *
 * A row can legitimately have no code: allocCode returns null when the RPC
 * fails and the insert omits the key (deuda técnica #14).
 */
export function composeCode(
  ancestors: (string | null | undefined)[],
  own: string | null | undefined
): string | null {
  const leaf = own?.trim();
  if (!leaf) return null;

  const prefix = ancestors
    .map((part) => part?.trim())
    .filter((part): part is string => !!part);

  return [...prefix, leaf].join('-');
}

/**
 * Sort key for a local code. Compares the trailing number, never the string:
 * lexicographic order puts T100 before T99, and the relevamiento measured a
 * node with 150 children, so the overflow is not hypothetical.
 *
 * Rows without a usable code sort last instead of colliding at zero.
 */
export function codeSortValue(code: string | null | undefined): number {
  const match = code?.match(/(\d+)\s*$/);
  return match ? parseInt(match[1], 10) : Number.MAX_SAFE_INTEGER;
}

// ---------------------------------------------------------------------------
// Progress — computed on read, never stored (ARQUITECTURA §5).
//
// task_status has no `cancelled` member, so the "done or cancelled" wording of
// ARQUITECTURA §5 does not apply to this database: only `done` counts as 100.
// `in_review` and `blocked` count as 0 — neither is finished work, and neither
// appears in a single row today.
// ---------------------------------------------------------------------------

type ProgressTask = {
  status: string;
  subtasks: { status: string }[];
};

/** A task with subtasks averages them; a leaf task is all-or-nothing. */
export function taskProgress(task: ProgressTask): number {
  if (task.subtasks.length > 0) {
    const done = task.subtasks.filter((s) => s.status === 'done').length;
    return (done / task.subtasks.length) * 100;
  }
  return task.status === 'done' ? 100 : 0;
}

/**
 * null, not 0, when the phase holds no tasks. A phase sitting at 0 % reads as
 * late; a phase with no data is not late, it is empty.
 */
export function phaseProgress(tasks: ProgressTask[]): number | null {
  if (tasks.length === 0) return null;
  return tasks.reduce((sum, task) => sum + taskProgress(task), 0) / tasks.length;
}

/**
 * D-15, rule C — orphan tasks do NOT feed the project number when the project
 * has phases.
 *
 * ARQUITECTURA §5 weighted every phase-less task the same as an entire phase.
 * Measured on project 7 that put 83 % of the numerator into 5 rows the
 * relevamiento had already classified as retroactive Handoff records, while
 * three phases holding 13 untouched tasks contributed nothing. Same principle
 * as C-4: two separate readings, never fused into one percentage. The orphan
 * block shows its own progress in its own header.
 *
 * A project with no phases at all has no phase average to take, so it falls
 * back to a flat average over its tasks.
 *
 * ONE FUNCTION IS THE WHOLE RULE. Switching to "orphans count as one more
 * phase" is an extra term in the first branch and nothing else.
 */
export function projectProgress(
  phases: { progress: number | null }[],
  orphanTasks: ProgressTask[]
): number | null {
  if (phases.length > 0) {
    const measurable = phases.filter(
      (phase): phase is { progress: number } => phase.progress !== null
    );
    if (measurable.length === 0) return null;
    return measurable.reduce((sum, phase) => sum + phase.progress, 0) / measurable.length;
  }

  if (orphanTasks.length === 0) return null;
  return orphanTasks.reduce((sum, task) => sum + taskProgress(task), 0) / orphanTasks.length;
}

// ---------------------------------------------------------------------------
// The tree
// ---------------------------------------------------------------------------

export type PhaseWithTasks = DbPhase & {
  tasks: TaskWithFullRelations[];
  progress: number | null;
};

export type ProjectWorkPlan = {
  /** Ordered by sort_order, then by code. */
  phases: PhaseWithTasks[];
  /** Tasks with phase_id NULL. Rendered in the collapsible "Sin fase" block. */
  orphanTasks: TaskWithFullRelations[];
  /**
   * Every task of the project, flat, in the order the fetcher returned them.
   * The header counter and the duplicate-title check read this instead of the
   * tree, so they keep reporting the acceptance number (37) rather than the
   * number of phases.
   */
  allTasks: TaskWithFullRelations[];
  progress: number | null;
};

const byCode = (a: { code: string | null }, b: { code: string | null }) =>
  codeSortValue(a.code) - codeSortValue(b.code);

/**
 * Groups a flat task list under its phases. Pure: takes rows, returns the tree.
 *
 * Invariant, by construction: phases' tasks plus orphanTasks always add up to
 * tasks.length. A phase_id pointing at a phase that is not in phaseRows would
 * otherwise make the task disappear from the screen without moving any counter
 * a human can check — exactly the silent-drift failure this project keeps
 * hitting. Those rows land in "Sin fase" instead.
 */
// ---------------------------------------------------------------------------
// Origin options — Etapa 2, sesión 1M
//
// Flat task/subtask list for the work item origin editor (chips + combobox
// in WorkItemRow) and for its labels. Lives here, not in a component, so
// the Server Component (page.tsx) and the Client Component
// (WorkItemsSection/WorkItemRow) derive the same codes from the same
// composeCode() instead of composing them twice. 'phase' is deliberately
// excluded — origins are only ever created from a task or subtask row
// (workItemOriginStore only accepts those two).
// ---------------------------------------------------------------------------

export type OriginOption = { type: 'task' | 'subtask'; id: number; label: string };

export function buildOriginOptions(workPlan: ProjectWorkPlan): OriginOption[] {
  const options: OriginOption[] = [];

  const addTask = (task: TaskWithFullRelations, phaseCode: string | null) => {
    const taskCode = composeCode([phaseCode], task.code);
    options.push({ type: 'task', id: task.id, label: taskCode ?? task.title });
    for (const sub of task.subtasks) {
      const subCode = composeCode([taskCode], sub.code);
      options.push({ type: 'subtask', id: sub.id, label: subCode ?? sub.title });
    }
  };

  for (const phase of workPlan.phases) {
    for (const task of phase.tasks) addTask(task, phase.code);
  }
  for (const task of workPlan.orphanTasks) addTask(task, null);

  return options;
}

export function buildWorkPlan(
  phaseRows: DbPhase[],
  tasks: TaskWithFullRelations[]
): ProjectWorkPlan {
  const byPhase = new Map<number, TaskWithFullRelations[]>();
  for (const phase of phaseRows) byPhase.set(phase.id, []);

  const orphanTasks: TaskWithFullRelations[] = [];

  for (const task of tasks) {
    const bucket = task.phase_id === null ? undefined : byPhase.get(task.phase_id);
    if (bucket) bucket.push(task);
    else orphanTasks.push(task);
  }

  const phases: PhaseWithTasks[] = phaseRows
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order || byCode(a, b))
    .map((phase) => {
      const phaseTasks = (byPhase.get(phase.id) ?? []).sort(byCode);
      return { ...phase, tasks: phaseTasks, progress: phaseProgress(phaseTasks) };
    });

  orphanTasks.sort(byCode);

  return {
    phases,
    orphanTasks,
    allTasks: tasks,
    progress: projectProgress(phases, orphanTasks),
  };
}
