'use client';

import { useState, useEffect } from 'react';
import { Plus, Save, X, Upload, RefreshCw, ChevronRight, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AssigneeSelector } from './AssigneeSelector';
import { TaskRow } from './TaskRow';
import { ImportTasksPanel } from './ImportTasksPanel';
import { ProgressBar } from './ProgressBar';
import { createProjectTask, getProjectWorkPlan } from '@/src/lib/supabase/project-task-actions';
import { phaseProgress, type ProjectWorkPlan, type PhaseWithTasks } from '@/src/lib/work-plan';
import { TASK_STATUSES, TASK_PRIORITIES } from '@/src/lib/task-constants';
import type { TaskWithFullRelations, DbTask, DbUser, DbPhase } from '@/src/lib/supabase/types';
import { PhaseForm } from './PhaseForm';
import { StatusBadge } from './StatusBadge';
import { PriorityBadge } from './PriorityBadge';

// ─────────────────────────────────────────────
// Tuning constants
//
// Sized against the relevamiento, not against today's small numbers: the
// normal case is ~12 items, 60 % of nodes have no children at all, and one
// node reached 150. Building for the current data breaks the next time the
// agency loads a real plan.
//
// PHASES_OPEN_BY_DEFAULT_MAX is the exception and no longer follows from
// that measurement — D-30 set it to 0 on legibility grounds. See its own
// comment below.
// ─────────────────────────────────────────────

// D-30: 0 means every phase starts collapsed, whatever the project's
// size. The section header already carries code, name, status, task
// count and progress, which is what a human scans for. The knob stays
// as a number instead of a boolean so raising it is a one-character
// change if we ever want small projects to open again.
const PHASES_OPEN_BY_DEFAULT_MAX = 0;

/** Tasks rendered per section before the cut. No virtualization, no library. */
const TASKS_VISIBLE_PER_PHASE = 25;

// ─────────────────────────────────────────────
// NewTaskRow
// ─────────────────────────────────────────────

type NewTaskRowProps = {
  projectId: number;
  users: Pick<DbUser, 'id' | 'name'>[];
  onSaved: () => void;
  onCancel: () => void;
  /**
   * Etapa 1, paso 1C — when present the task is born inside this phase and its
   * code comes from the phase counter. Absent keeps the previous behaviour
   * exactly: an orphan task numbered off the project.
   */
  phaseId?: number;
};

function NewTaskRow({ projectId, users, onSaved, onCancel, phaseId }: NewTaskRowProps) {
  const [form, setForm] = useState({
    title: '',
    status: 'todo' as DbTask['status'],
    priority: 'medium' as DbTask['priority'],
    due_date: '',
    description: '',
    assigneeIds: [] as number[],
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function save() {
    if (!form.title.trim()) return;
    setSaving(true);
    setSaveError(null);
    const { error } = await createProjectTask(
      projectId,
      {
        title: form.title,
        status: form.status,
        priority: form.priority,
        due_date: form.due_date || null,
        description: form.description.trim() || null,
      },
      form.assigneeIds,
      phaseId
    );
    setSaving(false);
    if (!error) {
      onSaved();
    } else {
      setSaveError(error);
    }
  }

  return (
    <div className="border border-primary/30 rounded-lg bg-blue-50/30 p-3 space-y-2 shadow-sm">
      <input
        autoFocus
        value={form.title}
        onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
        className="w-full rounded-md border border-border px-3 py-1.5 text-sm font-medium bg-white focus:outline-none focus:ring-1 focus:ring-primary"
        placeholder="Nombre de la tarea…"
        onKeyDown={(e) => {
          if (e.key === 'Enter') save();
          if (e.key === 'Escape') onCancel();
        }}
      />

      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={form.status}
          onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as DbTask['status'] }))}
          className="rounded-md border border-border px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-primary"
        >
          {TASK_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>

        <select
          value={form.priority}
          onChange={(e) =>
            setForm((f) => ({ ...f, priority: e.target.value as DbTask['priority'] }))
          }
          className="rounded-md border border-border px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-primary"
        >
          {TASK_PRIORITIES.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>

        <AssigneeSelector
          users={users}
          selectedIds={form.assigneeIds}
          onChange={(ids) => setForm((f) => ({ ...f, assigneeIds: ids }))}
          placeholder="Responsables"
        />

        <input
          type="date"
          value={form.due_date}
          onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
          className="rounded-md border border-border px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-primary"
        />

        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={save}
            disabled={saving || !form.title.trim()}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1 text-xs font-medium text-white hover:bg-primary/90 disabled:opacity-40 transition-colors"
          >
            <Save size={11} />
            {saving ? 'Guardando…' : 'Crear tarea'}
          </button>
          <button
            onClick={onCancel}
            className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1 text-xs text-muted-foreground hover:bg-muted transition-colors"
          >
            <X size={11} />
            Cancelar
          </button>
        </div>
      </div>

      <textarea
        value={form.description}
        onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
        className="w-full rounded-md border border-border px-3 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-primary resize-y"
        placeholder="Observaciones (opcional)…"
        rows={2}
      />

      {saveError && (
        <p className="mx-3 mb-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-1.5">
          {saveError}
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// TaskList
//
// The flat list of tasks used inside a phase, inside the "Sin fase" block and,
// when the project has no phases at all, on its own.
// ─────────────────────────────────────────────

type TaskListProps = {
  tasks: TaskWithFullRelations[];
  /** Phase code of the enclosing section, or null for phase-less tasks. */
  phaseCode: string | null;
  users: Pick<DbUser, 'id' | 'name'>[];
  projectId: number;
  onDelete: (taskId: number) => void;
  onRefresh: () => void;
  allPhases: Pick<DbPhase, 'id' | 'code' | 'name'>[];
  onMoved: (destPhaseId: number) => void;
};

function TaskList({ tasks, phaseCode, users, projectId, onDelete, onRefresh, allPhases, onMoved }: TaskListProps) {
  const [showAll, setShowAll] = useState(false);

  const hidden = tasks.length - TASKS_VISIBLE_PER_PHASE;
  const visible = showAll ? tasks : tasks.slice(0, TASKS_VISIBLE_PER_PHASE);

  return (
    <div className="space-y-2">
      {visible.map((task) => (
        <TaskRow
          key={task.id}
          task={task}
          phaseCode={phaseCode}
          users={users}
          projectId={projectId}
          allPhases={allPhases}
          onDelete={onDelete}
          onRefresh={onRefresh}
          onMoved={onMoved}
        />
      ))}

      {hidden > 0 && !showAll && (
        <button
          onClick={() => setShowAll(true)}
          className="w-full rounded-lg border border-dashed border-border py-1.5 text-xs text-muted-foreground hover:text-primary hover:bg-muted/30 transition-colors"
        >
          Mostrar {hidden} más
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// WorkSection
//
// One collapsible block. Used for a real phase and for the "Sin fase" block:
// the UI is the same and the only difference is whether there is a code, so it
// takes a prop instead of being duplicated.
// ─────────────────────────────────────────────

type WorkSectionProps = {
  /** null renders no code badge — the "Sin fase" block has none. */
  code: string | null;
  name: string;
  tasks: TaskWithFullRelations[];
  /** null when there is nothing to average. Renders "—", never 0 %. */
  progress: number | null;
  open: boolean;
  onToggle: () => void;
  users: Pick<DbUser, 'id' | 'name'>[];
  projectId: number;
  onDelete: (taskId: number) => void;
  onRefresh: () => void;
  /**
   * Etapa 1, paso 1C — present only for a real phase. The "Sin fase" block
   * leaves it undefined and therefore renders no footer: it already has its
   * own button at the bottom of the list.
   */
  phaseId?: number;
  /**
   * Etapa 1, paso 1C-b — the phase row itself, for the status/priority
   * badges and the edit form. Undefined in the "Sin fase" block, which
   * has no phase behind it. `code` and `name` stay as separate props for
   * exactly that reason.
   */
  phase?: PhaseWithTasks;
  allPhases: Pick<DbPhase, 'id' | 'code' | 'name'>[];
  onMoved: (destPhaseId: number) => void;
};

function WorkSection({
  code,
  name,
  tasks,
  progress,
  open,
  onToggle,
  users,
  projectId,
  onDelete,
  onRefresh,
  phaseId,
  phase,
  allPhases,
  onMoved,
}: WorkSectionProps) {
  const hasTasks = tasks.length > 0;
  const isPhase = phaseId !== undefined;
  // Each section owns its form state, so opening one phase's form does not
  // open every other one.
  const [showNewTask, setShowNewTask] = useState(false);
  const [editing, setEditing] = useState(false);

  // Paso 1C — a real phase stays expandable with zero tasks: otherwise it can
  // never be opened, and a phase that cannot be opened can never receive its
  // first task. The "no chevron without children" rule is unchanged for tasks
  // and subtasks; it only bends for phases, which are containers by nature.
  const expandable = hasTasks || isPhase;

  return (
    <div className="rounded-xl border border-border bg-white shadow-sm">
      {/* Header. A div and not a button: it holds block-level children, and
          TaskRow already uses this same clickable-div pattern for its title. */}
      {editing && phase ? (
        <PhaseForm
          mode="edit"
          projectId={projectId}
          phase={phase}
          onSaved={() => {
            setEditing(false);
            onRefresh();
          }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <div
          onClick={() => expandable && onToggle()}
          className={cn(
            'flex items-center gap-3 px-4 py-3',
            expandable && 'cursor-pointer hover:bg-muted/20 transition-colors'
          )}
        >
          {/* Sin chevron en nodos sin hijos: 6 de cada 10 no abren nada.
              Una fase es la excepción: abre para poder recibir su primera. */}
          <ChevronRight
            size={16}
            className={cn(
              'shrink-0 text-muted-foreground transition-transform',
              open && 'rotate-90',
              !expandable && 'invisible'
            )}
          />

          {code && (
            <span className="shrink-0 font-mono text-xs text-muted-foreground">{code}</span>
          )}

          <span className="flex-1 min-w-0 truncate text-sm font-semibold text-foreground">
            {name}
          </span>

          {/* Badges reutilizados de tarea/proyecto: DbPhase['status'] y
              DbPhase['priority'] son la misma unión, no hace falta una tercera
              lista de etiquetas. */}
          {phase && (
            <div className="shrink-0 flex items-center gap-1.5">
              <StatusBadge status={phase.status} />
              <PriorityBadge priority={phase.priority} />
            </div>
          )}

          <span className="shrink-0 text-xs text-muted-foreground">
            {tasks.length} tarea{tasks.length === 1 ? '' : 's'}
          </span>

          <div className="shrink-0 w-24">
            {progress === null ? (
              <span className="block text-right text-xs text-muted-foreground">—</span>
            ) : (
              <>
                <span className="block text-right text-xs text-muted-foreground mb-1">
                  {progress.toFixed(1)}%
                </span>
                {/* showLabel explícito: el default es true e imprimiría "78/100"
                    al lado del 77.8 %, dos números del mismo dato. */}
                <ProgressBar done={Math.round(progress)} total={100} showLabel={false} />
              </>
            )}
          </div>

          {/* stopPropagation obligatorio: la cabecera entera lleva el onClick que
              colapsa la sección, y sin él editar cerraría la fase a la vez. */}
          {phase && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setEditing(true);
              }}
              className="shrink-0 rounded-md p-1 text-muted-foreground hover:text-primary hover:bg-muted transition-colors"
              title="Editar fase"
            >
              <Pencil size={13} />
            </button>
          )}
        </div>
      )}

      {open && (hasTasks || isPhase) && (
        <div className="border-t border-border bg-muted/10 p-3 space-y-3">
          {hasTasks && (
            <TaskList
              tasks={tasks}
              phaseCode={code}
              users={users}
              projectId={projectId}
              onDelete={onDelete}
              onRefresh={onRefresh}
              allPhases={allPhases}
              onMoved={onMoved}
            />
          )}

          {/* Pie de fase. Sólo en fases reales: la sección "Sin fase" ya tiene
              su propio botón al pie de la lista y tendría dos que hacen lo
              mismo. Mismo patrón visual que ese botón. */}
          {isPhase &&
            (showNewTask ? (
              <NewTaskRow
                projectId={projectId}
                phaseId={phaseId}
                users={users}
                onSaved={() => {
                  setShowNewTask(false);
                  onRefresh();
                }}
                onCancel={() => setShowNewTask(false)}
              />
            ) : (
              <button
                onClick={() => setShowNewTask(true)}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2 text-sm font-medium text-muted-foreground hover:text-primary hover:bg-muted/30 transition-colors"
              >
                <Plus size={14} />
                Nueva tarea en esta fase
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// ProjectTasksClient
// ─────────────────────────────────────────────

type Props = {
  initialWorkPlan: ProjectWorkPlan;
  users: Pick<DbUser, 'id' | 'name'>[];
  projectId: number;
};

export function ProjectTasksClient({ initialWorkPlan, users, projectId }: Props) {
  const [workPlan, setWorkPlan] = useState<ProjectWorkPlan>(initialWorkPlan);
  const [showNewTask, setShowNewTask] = useState(false);
  const [showImport, setShowImport] = useState(false);
  // Fase 8B — mismo panel, modo 'update'. Nunca los dos abiertos a la vez.
  const [showUpdate, setShowUpdate] = useState(false);
  const [showNewPhase, setShowNewPhase] = useState(false);

  // Collapse state, local. No fourth Zustand store: nothing outside this
  // subtree cares which phases are open. Phases missing from the record fall
  // back to the default, so a phase created later inherits it instead of
  // appearing closed for no reason.
  const [phaseOpen, setPhaseOpen] = useState<Record<number, boolean>>({});
  // D-31: starts collapsed like every phase does since D-30. Two rules for
  // the same gesture is worse than either rule on its own. Deliberately not
  // derived from `openByDefault`: that one keys off the phase count, and
  // orphan tasks have nothing to do with how many phases exist.
  const [orphansOpen, setOrphansOpen] = useState(false);

  const openByDefault = workPlan.phases.length <= PHASES_OPEN_BY_DEFAULT_MAX;
  const isPhaseOpen = (phaseId: number) => phaseOpen[phaseId] ?? openByDefault;
  const togglePhase = (phaseId: number) =>
    setPhaseOpen((prev) => ({ ...prev, [phaseId]: !(prev[phaseId] ?? openByDefault) }));

  // Sync when the parent Server Component re-fetches (e.g. first load / navigation)
  useEffect(() => {
    setWorkPlan(initialWorkPlan);
  }, [initialWorkPlan]);

  // Re-fetches the full tree with all relations and replaces local state directly.
  // Used instead of router.refresh() everywhere below, which raced with the DB write
  // (revalidatePath + client re-render could resolve before the insert's effects were
  // visible to the next read) and left new subtasks invisible until a manual reload.
  async function refresh() {
    const fresh = await getProjectWorkPlan(projectId);
    setWorkPlan(fresh);
  }

  // C-1: a task moved into a collapsed phase would vanish from the screen
  // the moment refresh() rebuilds the tree, which reads as a delete. Open
  // the destination first, then refresh. Setting it to true works whatever
  // the default open state is.
  function handleMoved(destPhaseId: number) {
    setPhaseOpen((prev) => ({ ...prev, [destPhaseId]: true }));
    refresh();
  }

  // Minimal shape for the move dropdown. Recomputed per render on purpose:
  // the array is one small object per phase and skipping useMemo keeps the
  // dependency list out of a 600-line component.
  const phaseOptions = workPlan.phases.map((p) => ({
    id: p.id,
    code: p.code,
    name: p.name,
  }));

  // Etapa 1, paso 1B — deleting a task changes the progress of its phase and of
  // the project, so the list can no longer be patched locally: both bars would
  // keep showing the old number. Same reasoning as the comment on refresh().
  // The signature stays (taskId: number) => void so TaskRow does not change.
  function handleDelete() {
    refresh();
  }

  const hasPhases = workPlan.phases.length > 0;
  const orphanProgress = phaseProgress(workPlan.orphanTasks);

  // D-17 — this list-level create footer only exists in projects with NO phases.
  // Once a project has phases every task is born inside one, so the only way in
  // is the footer of each WorkSection, which passes its phaseId to
  // `alloc_task_code_in_phase`. Creating an orphan from here would put the task
  // somewhere the user is not looking at.

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-foreground">
          Tareas{' '}
          <span className="text-muted-foreground font-normal text-sm">
            ({workPlan.allTasks.length})
          </span>
        </h2>
        <div className="flex items-center gap-2">
          {!showNewTask && (
            <button
              onClick={() => {
                setShowImport(false);
                setShowUpdate(false);
                setShowNewPhase(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary/90 transition-colors"
            >
              <Plus size={14} />
              Nueva fase
            </button>
          )}
          {!showNewTask && (
            <button
              onClick={() => {
                setShowUpdate(false);
                setShowImport(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              <Upload size={14} />
              Importar tareas
            </button>
          )}
          {!showNewTask && (
            <button
              onClick={() => {
                setShowImport(false);
                setShowUpdate(true);
              }}
              disabled
              title="Disponible de nuevo en la Etapa 3"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <RefreshCw size={14} />
              Actualizar tareas
            </button>
          )}
        </div>
      </div>

      {/* Work plan */}
      {workPlan.allTasks.length === 0 && !hasPhases && !showNewTask && !showNewPhase ? (
        <div className="rounded-xl border border-dashed border-border bg-white p-10 text-center">
          <p className="text-sm text-muted-foreground">
            No hay tareas para este proyecto.{' '}
            <button
              onClick={() => setShowNewTask(true)}
              className="text-primary hover:underline"
            >
              Crear la primera
            </button>{' '}
            o{' '}
            <button onClick={() => setShowImport(true)} className="text-primary hover:underline">
              importar varias
            </button>
            .
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {hasPhases ? (
            <>
              {workPlan.phases.map((phase) => (
                <WorkSection
                  key={phase.id}
                  code={phase.code}
                  name={phase.name}
                  tasks={phase.tasks}
                  progress={phase.progress}
                  phaseId={phase.id}
                  phase={phase}
                  open={isPhaseOpen(phase.id)}
                  onToggle={() => togglePhase(phase.id)}
                  users={users}
                  projectId={projectId}
                  onDelete={handleDelete}
                  onRefresh={refresh}
                  allPhases={phaseOptions}
                  onMoved={handleMoved}
                />
              ))}

              {workPlan.orphanTasks.length > 0 && (
                <WorkSection
                  code={null}
                  name="Sin fase"
                  tasks={workPlan.orphanTasks}
                  progress={orphanProgress}
                  open={orphansOpen}
                  onToggle={() => setOrphansOpen((o) => !o)}
                  users={users}
                  projectId={projectId}
                  onDelete={handleDelete}
                  onRefresh={refresh}
                  allPhases={phaseOptions}
                  onMoved={handleMoved}
                />
              )}
            </>
          ) : (
            // Proyecto sin ninguna fase: lista plana, sin envoltorio. Meter dos
            // tareas dentro de un acordeón titulado "Sin fase" se lee como un
            // error, no como una clasificación.
            <TaskList
              tasks={workPlan.orphanTasks}
              phaseCode={null}
              users={users}
              projectId={projectId}
              onDelete={handleDelete}
              onRefresh={refresh}
              allPhases={phaseOptions}
              onMoved={handleMoved}
            />
          )}

          {!hasPhases && !showNewPhase &&
            (showNewTask ? (
              <NewTaskRow
                projectId={projectId}
                users={users}
                onSaved={() => {
                  setShowNewTask(false);
                  refresh();
                }}
                onCancel={() => setShowNewTask(false)}
              />
            ) : (
              <button
                onClick={() => setShowNewTask(true)}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2 text-sm font-medium text-muted-foreground hover:text-primary hover:bg-muted/30 transition-colors"
              >
                <Plus size={14} />
                Nueva tarea
              </button>
            ))}

          {showNewPhase && (
            <PhaseForm
              mode="create"
              projectId={projectId}
              onSaved={() => {
                setShowNewPhase(false);
                setShowNewTask(false);
                refresh();
              }}
              onCancel={() => setShowNewPhase(false)}
            />
          )}
        </div>
      )}

      {showImport && (
        <ImportTasksPanel
          projectId={projectId}
          mode="import"
          existingTitles={workPlan.allTasks.map((t) => t.title)}
          onClose={() => setShowImport(false)}
          onImported={() => {
            setShowImport(false);
            refresh();
          }}
        />
      )}

      {showUpdate && (
        <ImportTasksPanel
          projectId={projectId}
          mode="update"
          existingTitles={workPlan.allTasks.map((t) => t.title)}
          onClose={() => setShowUpdate(false)}
          onImported={() => {
            setShowUpdate(false);
            refresh();
          }}
        />
      )}
    </div>
  );
}
