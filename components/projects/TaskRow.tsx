'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronRight,
  AlertOctagon,
  Trash2,
  Save,
  X,
  Plus,
  Clock,
  FolderInput,
  Pencil,
} from 'lucide-react';
import { format, parseISO, isPast, isToday } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { StatusBadge } from './StatusBadge';
import { PriorityBadge } from './PriorityBadge';
import { ProgressBar } from './ProgressBar';
import { AssigneeSelector, AssigneeAvatars } from './AssigneeSelector';
import { RowActionMenu } from './RowActionMenu';
import {
  updateProjectTask,
  deleteProjectTask,
  moveTaskToPhase,
  createProjectSubtask,
  updateProjectSubtask,
  deleteProjectSubtask,
} from '@/src/lib/supabase/project-task-actions';
import { TASK_STATUSES, TASK_PRIORITIES } from '@/src/lib/task-constants';
import { composeCode } from '@/src/lib/work-plan';
import { useWorkItemOriginStore, type PendingWorkItemOrigin } from '@/src/store/workItemOriginStore';
import type {
  TaskWithFullRelations,
  SubtaskWithAssignees,
  DbTask,
  DbSubtask,
  DbUser,
  DbPhase,
} from '@/src/lib/supabase/types';

// ─────────────────────────────────────────────
// Origin menu items — shared by TaskRow and SubtaskRow triggers
// ─────────────────────────────────────────────

const WORK_ITEM_TYPE_LABELS: Record<PendingWorkItemOrigin['workItemType'], string> = {
  bug: 'Reportar bug',
  debt: 'Registrar deuda técnica',
  question_rfc: 'Abrir pregunta/RFC',
};

function buildOriginMenuItems(
  setPending: (p: PendingWorkItemOrigin) => void,
  originType: 'task' | 'subtask',
  originId: number,
  originLabel: string
) {
  return (Object.keys(WORK_ITEM_TYPE_LABELS) as PendingWorkItemOrigin['workItemType'][]).map(
    (workItemType) => ({
      key: workItemType,
      label: WORK_ITEM_TYPE_LABELS[workItemType],
      onSelect: () => setPending({ workItemType, originType, originId, originLabel }),
    })
  );
}

// ─────────────────────────────────────────────
// SubtaskRow
// ─────────────────────────────────────────────

type SubtaskRowProps = {
  subtask: SubtaskWithAssignees;
  /** Composite code of the parent task ("F0-T03"), already assembled. */
  parentCode?: string | null;
  users: Pick<DbUser, 'id' | 'name'>[];
  projectId: number;
  onRefresh: () => void;
  /** Etapa 2, sesión 1M — how many work items reference this row, keyed `subtask:${id}`. */
  originCounts: Record<string, number>;
};

function SubtaskRow({ subtask, parentCode, users, projectId, onRefresh, originCounts }: SubtaskRowProps) {
  const subtaskCode = composeCode([parentCode], subtask.code);
  const setPending = useWorkItemOriginStore((s) => s.setPending);
  const originCount = originCounts[`subtask:${subtask.id}`] ?? 0;
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    title: subtask.title,
    status: subtask.status,
    priority: subtask.priority,
    due_date: subtask.due_date ?? '',
    description: subtask.description ?? '',
    assigneeIds: subtask.assignees.map((a) => a.id),
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const isOverdue =
    subtask.due_date &&
    subtask.status !== 'done' &&
    isPast(parseISO(subtask.due_date)) &&
    !isToday(parseISO(subtask.due_date));

  async function save() {
    if (!form.title.trim()) return;
    setSaving(true);
    setSaveError(null);
    const { error } = await updateProjectSubtask(
      subtask.id,
      projectId,
      {
        title: form.title,
        status: form.status as DbSubtask['status'],
        priority: form.priority as DbSubtask['priority'],
        due_date: form.due_date || null,
        description: form.description.trim() || null,
      },
      form.assigneeIds
    );
    setSaving(false);
    if (!error) {
      setEditing(false);
      onRefresh();
    } else {
      setSaveError(error);
    }
  }

  async function handleDelete() {
    if (!confirm(`¿Eliminar la subtarea "${subtask.title}"?`)) return;
    const { error } = await deleteProjectSubtask(subtask.id, projectId);
    if (!error) {
      onRefresh();
    }
  }

  async function toggleComplete() {
    const newStatus: DbSubtask['status'] = subtask.completed ? 'todo' : 'done';
    await updateProjectSubtask(
      subtask.id,
      projectId,
      { status: newStatus },
      subtask.assignees.map((a) => a.id)
    );
    onRefresh();
  }

  if (editing) {
    return (
      <div className="flex flex-col border-t border-border bg-primary/5">
        <div className="flex items-center gap-2 px-5 py-2.5 flex-wrap">
        <input
          autoFocus
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          className="flex-1 min-w-[140px] rounded-md border border-border px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary bg-white"
          placeholder="Nombre de la subtarea"
          onKeyDown={(e) => {
            if (e.key === 'Enter') save();
            if (e.key === 'Escape') setEditing(false);
          }}
        />
        <select
          value={form.status}
          onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as DbSubtask["status"] }))}
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
          onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as DbSubtask['priority'] }))}
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
        />
        <input
          type="date"
          value={form.due_date}
          onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
          className="rounded-md border border-border px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <button
          onClick={save}
          disabled={saving || !form.title.trim()}
          className="flex h-6 w-6 items-center justify-center rounded text-green-600 hover:bg-green-100 disabled:opacity-40 transition-colors"
          title="Guardar"
        >
          <Save size={12} />
        </button>
        <button
          onClick={() => setEditing(false)}
          className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted transition-colors"
          title="Cancelar"
        >
          <X size={12} />
        </button>
        </div>
        <div className="px-5 pb-2.5">
          <textarea
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            className="w-full rounded-md border border-border px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary bg-white resize-y"
            placeholder="Observaciones (opcional)…"
            rows={2}
          />
        </div>
        {saveError && (
          <p className="px-5 pb-2 text-[10px] text-red-600">{saveError}</p>
        )}
      </div>
    );
  }

  return (
    <div className="group flex items-start gap-3 px-5 py-2.5 border-t border-border hover:bg-muted/20 transition-colors">
      {/* Checkbox quick-complete */}
      <button
        onClick={toggleComplete}
        className={cn(
          'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
          subtask.completed
            ? 'bg-green-500 border-green-500 text-white'
            : 'border-border bg-white hover:border-primary'
        )}
      >
        {subtask.completed && (
          <svg viewBox="0 0 10 10" className="h-2.5 w-2.5">
            <polyline
              points="1.5,5 4,8 8.5,2"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>

      {/* Title + observaciones */}
      <div
        onClick={() => setEditing(true)}
        className="flex-1 min-w-0 cursor-pointer select-none"
      >
        <span
          className={cn(
            'flex items-baseline gap-1.5 min-w-0 text-xs',
            subtask.completed && 'line-through text-muted-foreground'
          )}
        >
          {/* Fase 8A — code prefix. stopPropagation so dragging to select it
              does not open the inline editor; no-underline keeps it readable
              when the parent is struck through. */}
          {subtaskCode && (
            <span
              onClick={(e) => e.stopPropagation()}
              className="shrink-0 cursor-text select-text font-mono text-[10px] text-muted-foreground no-underline"
            >
              {subtaskCode}
            </span>
          )}
          {originCount > 0 && (
            <span
              onClick={(e) => e.stopPropagation()}
              className="shrink-0 text-[10px] text-muted-foreground no-underline"
              title="Bugs/deuda técnica/preguntas vinculados a esta subtarea"
            >
              · {originCount} emergente{originCount === 1 ? '' : 's'}
            </span>
          )}
          <span className="truncate">{subtask.title}</span>
        </span>
        {subtask.description && (
          <span className="block text-[10px] text-muted-foreground truncate mt-0.5">
            {subtask.description}
          </span>
        )}
      </div>

      {/* Assignees */}
      {subtask.assignees.length > 0 && (
        <AssigneeAvatars users={subtask.assignees} max={2} />
      )}

      {/* Status */}
      <StatusBadge status={subtask.status} className="text-[10px] py-0 px-1.5 shrink-0" />

      {/* Priority */}
      <PriorityBadge priority={subtask.priority} className="text-[10px] py-0 px-1.5 shrink-0" />

      {/* Due date */}
      {subtask.due_date && (
        <span
          className={cn(
            'text-[10px] shrink-0 flex items-center gap-0.5',
            isOverdue ? 'text-red-500 font-medium' : 'text-muted-foreground'
          )}
        >
          {isOverdue && <Clock size={9} />}
          {format(parseISO(subtask.due_date), 'd MMM', { locale: es })}
        </span>
      )}

      {/* Edit */}
      <button
        onClick={() => setEditing(true)}
        className="opacity-0 group-hover:opacity-100 flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-primary transition-all"
        title="Editar"
      >
        <Pencil size={10} />
      </button>

      {/* Reportar bug / deuda / pregunta desde esta subtarea. Etapa 2,
          sesión 1M — origin_type siempre 'subtask' acá. */}
      <RowActionMenu
        title="Crear emergente desde esta subtarea"
        menuLabel="Crear desde esta subtarea"
        items={buildOriginMenuItems(setPending, 'subtask', subtask.id, subtaskCode ?? subtask.title)}
        triggerClassName="opacity-0 group-hover:opacity-100 h-5 w-5 transition-all"
      />

      {/* Delete */}
      <button
        onClick={handleDelete}
        className="opacity-0 group-hover:opacity-100 flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-red-500 transition-all"
        title="Eliminar"
      >
        <Trash2 size={10} />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────
// NewSubtaskRow
// ─────────────────────────────────────────────

type NewSubtaskRowProps = {
  taskId: number;
  projectId: number;
  users: Pick<DbUser, 'id' | 'name'>[];
  onSaved: () => void;
  onCancel: () => void;
};

function NewSubtaskRow({ taskId, projectId, users, onSaved, onCancel }: NewSubtaskRowProps) {
  const [form, setForm] = useState({
    title: '',
    status: 'todo' as DbSubtask['status'],
    priority: 'medium' as DbSubtask['priority'],
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
    const { error } = await createProjectSubtask(
      taskId,
      projectId,
      {
        title: form.title,
        status: form.status,
        priority: form.priority,
        due_date: form.due_date || null,
        description: form.description.trim() || null,
      },
      form.assigneeIds
    );
    setSaving(false);
    if (!error) {
      onSaved();
    } else {
      setSaveError(error);
    }
  }

  return (
    <div className="flex flex-col border-t border-border bg-blue-50/40">
    <div className="flex items-center gap-2 px-5 py-2.5 flex-wrap">
      <input
        autoFocus
        value={form.title}
        onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
        className="flex-1 min-w-[140px] rounded-md border border-primary/40 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary bg-white"
        placeholder="Nombre de la subtarea…"
        onKeyDown={(e) => {
          if (e.key === 'Enter') save();
          if (e.key === 'Escape') onCancel();
        }}
      />
      <select
        value={form.status}
        onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as DbSubtask['status'] }))}
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
        onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as DbSubtask['priority'] }))}
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
      />
      <input
        type="date"
        value={form.due_date}
        onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
        className="rounded-md border border-border px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-primary"
      />
      <button
        onClick={save}
        disabled={saving || !form.title.trim()}
        className="flex h-6 w-6 items-center justify-center rounded text-green-600 hover:bg-green-100 disabled:opacity-40 transition-colors"
        title="Guardar subtarea"
      >
        <Save size={12} />
      </button>
      <button
        onClick={onCancel}
        className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted transition-colors"
        title="Cancelar"
      >
        <X size={12} />
      </button>
    </div>
    <div className="px-5 pb-2.5">
      <textarea
        value={form.description}
        onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
        className="w-full rounded-md border border-primary/40 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary bg-white resize-y"
        placeholder="Observaciones (opcional)…"
        rows={2}
      />
    </div>
    {saveError && (
      <p className="px-5 pb-2 text-[10px] text-red-600">{saveError}</p>
    )}
    </div>
  );
}

// ─────────────────────────────────────────────
// MOVE TO PHASE (Etapa 1, paso C-1)
// ─────────────────────────────────────────────

/** Menu is right-aligned to its trigger so it never runs off the row. */
const MOVE_MENU_WIDTH = 248;
/** Approximate height, used to decide whether the menu opens up or down. */
const MOVE_MENU_MAX_HEIGHT = 260;

// ─────────────────────────────────────────────
// TaskRow (main export)
// ─────────────────────────────────────────────

type TaskRowProps = {
  task: TaskWithFullRelations;
  /** Code of the enclosing phase, or null for a phase-less task. */
  phaseCode?: string | null;
  users: Pick<DbUser, 'id' | 'name'>[];
  projectId: number;
  /** Every phase of the project, for the C-1 move control. */
  allPhases: Pick<DbPhase, 'id' | 'code' | 'name'>[];
  onDelete: (taskId: number) => void;
  onRefresh: () => void;
  /** Fired after a successful move, with the destination phase id. */
  onMoved: (destPhaseId: number) => void;
  /** Etapa 2, sesión 1M — how many work items reference each task/subtask, keyed `task:${id}`/`subtask:${id}`. */
  originCounts: Record<string, number>;
};

export function TaskRow({ task, phaseCode, users, projectId, allPhases, onDelete, onRefresh, onMoved, originCounts }: TaskRowProps) {
  const taskCode = composeCode([phaseCode], task.code);
  const setPending = useWorkItemOriginStore((s) => s.setPending);
  const originCount = originCounts[`task:${task.id}`] ?? 0;

  // C-1 · destinations exclude the task's own phase. For an orphan task
  // `task.phase_id` is null and every phase qualifies. There is no reverse
  // move on purpose: a task enters a phase and does not go back to the
  // project-level orphan namespace (D-25).
  const moveTargets = allPhases.filter((p) => p.id !== task.phase_id);

  const [moving, setMoving] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [movePos, setMovePos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const moveButtonRef = useRef<HTMLButtonElement>(null);

  function openMoveMenu() {
    if (moving || !moveButtonRef.current) return;
    const rect = moveButtonRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const top =
      spaceBelow >= MOVE_MENU_MAX_HEIGHT ? rect.bottom + 4 : rect.top - MOVE_MENU_MAX_HEIGHT - 4;
    setMovePos({ top, left: Math.max(8, rect.right - MOVE_MENU_WIDTH) });
    setMoveOpen((v) => !v);
  }

  // Position is computed once on open and the menu is `fixed`, so a scroll or
  // resize would leave it floating away from its row: close instead of
  // recomputing. The trigger is excluded from the outside-click handler, so
  // clicking it while open still toggles rather than closing and reopening.
  useEffect(() => {
    if (!moveOpen) return;
    const close = () => setMoveOpen(false);
    const onDown = (e: MouseEvent) => {
      if (moveButtonRef.current?.contains(e.target as Node)) return;
      setMoveOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMoveOpen(false);
    };
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [moveOpen]);

  /**
   * D-32 — the menu closes and the trigger disables before the await, so no
   * second click target exists while the move is in flight. Two concurrent
   * calls would each reserve a code from the destination phase and burn one
   * for nothing: watermarks never decrease, so a double submit leaves a
   * permanent gap in that phase's numbering. This guard is UI-level only —
   * the database holds no lock of its own here (D-27).
   */
  async function handleMove(destPhaseId: number) {
    if (moving) return;
    setMoveOpen(false);
    setMoving(true);
    const { error } = await moveTaskToPhase(task.id, projectId, destPhaseId);
    setMoving(false);
    if (error) {
      alert(error);
      return;
    }
    // Not onRefresh: every phase starts collapsed since D-30, so the task
    // would vanish from the screen and read as a delete. `onMoved` opens the
    // destination first, then rebuilds the tree.
    onMoved(destPhaseId);
  }

  const moveMenu =
    moveOpen && typeof window !== 'undefined'
      ? createPortal(
          <div
            role="listbox"
            style={{ top: movePos.top, left: movePos.left, width: MOVE_MENU_WIDTH }}
            className="fixed z-[9999] max-h-[260px] overflow-y-auto rounded-lg border border-border bg-white shadow-lg py-1 animate-in fade-in-0 zoom-in-95 duration-100"
          >
            <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Mover a
            </div>
            {moveTargets.map((p) => (
              <button
                key={p.id}
                role="option"
                aria-selected={false}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleMove(p.id);
                }}
                className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-xs transition-colors hover:bg-muted"
              >
                <span className="shrink-0 font-mono text-muted-foreground">{p.code}</span>
                <span className="truncate">{p.name}</span>
              </button>
            ))}
          </div>,
          document.body
        )
      : null;

  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showNewSubtask, setShowNewSubtask] = useState(false);
  const [form, setForm] = useState({
    title: task.title,
    status: task.status,
    priority: task.priority,
    due_date: task.due_date ?? '',
    is_blocked: task.is_blocked,
    blocked_reason: task.blocked_reason ?? '',
    description: task.description ?? '',
    assigneeIds: task.assignees.map((a) => a.id),
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const isOverdue =
    task.due_date &&
    task.status !== 'done' &&
    isPast(parseISO(task.due_date)) &&
    !isToday(parseISO(task.due_date));

  const subtasksDone = task.subtasks.filter((s) => s.status === 'done').length;
  const subtasksTotal = task.subtasks.length;

  async function save() {
    if (!form.title.trim()) return;
    setSaving(true);
    const { error } = await updateProjectTask(
      task.id,
      projectId,
      {
        title: form.title,
        status: form.status as DbTask['status'],
        priority: form.priority as DbTask['priority'],
        due_date: form.due_date || null,
        is_blocked: form.is_blocked,
        blocked_reason: form.blocked_reason || null,
        description: form.description.trim() || null,
      },
      form.assigneeIds
    );
    setSaving(false);
    if (!error) {
      setEditing(false);
      onRefresh();
    } else {
      setSaveError(error);
    }
  }

  async function handleDelete() {
    if (task.subtasks.length > 0) {
      alert('Esta tarea tiene subtareas. Elimínalas primero para poder eliminar la tarea.');
      return;
    }
    if (!confirm(`¿Eliminar la tarea "${task.title}"?`)) return;
    const { error } = await deleteProjectTask(task.id, projectId);
    if (!error) {
      onDelete(task.id);
    } else {
      alert(error);
    }
  }

  // ── Edit mode ─────────────────────────────
  if (editing) {
    return (
      <div className="border border-primary/30 rounded-lg bg-white shadow-sm">
        <div className="p-3 space-y-2">
          {/* Row 1: title */}
          <input
            autoFocus
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            className="w-full rounded-md border border-border px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="Nombre de la tarea"
            onKeyDown={(e) => {
              if (e.key === 'Escape') setEditing(false);
            }}
          />

          {/* Row 2: metadata */}
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={form.status}
              onChange={(e) => {
                const s = e.target.value as DbTask['status'];
                setForm((f) => ({ ...f, status: s as DbTask['status'], is_blocked: s === 'blocked' }));
              }}
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
              onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as DbTask["priority"] }))}
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
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
              <button
                onClick={() => setEditing(false)}
                className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1 text-xs text-muted-foreground hover:bg-muted transition-colors"
              >
                <X size={11} />
                Cancelar
              </button>
            </div>
          </div>

          {/* Blocked reason */}
          {form.is_blocked && (
            <input
              value={form.blocked_reason}
              onChange={(e) => setForm((f) => ({ ...f, blocked_reason: e.target.value }))}
              className="w-full rounded-md border border-red-300 bg-red-50 px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-red-400"
              placeholder="Motivo del bloqueo…"
            />
          )}

          {/* Observaciones */}
          <textarea
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            className="w-full rounded-md border border-border px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary resize-y"
            placeholder="Observaciones (opcional)…"
            rows={2}
          />

          {saveError && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-1.5">
              {saveError}
            </p>
          )}
        </div>
      </div>
    );
  }

  // ── View mode ──────────────────────────────
  return (
    <div className="border border-border rounded-lg bg-white shadow-sm">
      {/* Task header row */}
      <div className="flex items-start gap-3 px-4 py-3 hover:bg-muted/20 transition-colors">
        {/* Expand chevron */}
        <button
          onClick={() => subtasksTotal > 0 && setExpanded((e) => !e)}
          className={cn(
            'mt-0.5 shrink-0 text-muted-foreground transition-transform',
            expanded && 'rotate-90',
            subtasksTotal === 0 && 'invisible'
          )}
        >
          <ChevronRight size={15} />
        </button>

        {/* Title + meta */}
        <div
          className="flex-1 min-w-0 cursor-pointer"
          onClick={() => setEditing(true)}
        >
          <div className="flex items-center gap-2">
            {/* Fase 8A — code prefix. stopPropagation so dragging to select it
                does not open the inline editor. */}
            {taskCode && (
              <span
                onClick={(e) => e.stopPropagation()}
                className="shrink-0 cursor-text select-text font-mono text-[11px] text-muted-foreground"
              >
                {taskCode}
              </span>
            )}
            {originCount > 0 && (
              <span
                onClick={(e) => e.stopPropagation()}
                className="shrink-0 text-[11px] text-muted-foreground"
                title="Bugs/deuda técnica/preguntas vinculados a esta tarea"
              >
                · {originCount} emergente{originCount === 1 ? '' : 's'}
              </span>
            )}
            <p className="text-sm font-medium text-foreground truncate">{task.title}</p>
            {isOverdue && (
              <span className="shrink-0 flex items-center gap-1 text-[10px] font-medium text-red-600">
                <Clock size={10} />
                Atrasada
              </span>
            )}
          </div>

          {task.is_blocked && task.blocked_reason && (
            <p className="mt-0.5 flex items-start gap-1 text-xs text-red-600">
              <AlertOctagon size={11} className="mt-0.5 shrink-0" />
              {task.blocked_reason}
            </p>
          )}

          {task.description && (
            <p className="mt-0.5 text-xs text-muted-foreground truncate">{task.description}</p>
          )}

          {subtasksTotal > 0 && (
            <div className="mt-1.5 max-w-[180px]">
              <ProgressBar done={subtasksDone} total={subtasksTotal} showLabel={false} />
            </div>
          )}
        </div>

        {/* Right-side meta */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          {task.is_blocked && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700">
              <AlertOctagon size={10} />
              Bloqueada
            </span>
          )}
          <StatusBadge status={task.status} />
          <PriorityBadge priority={task.priority} />

          {task.assignees.length > 0 && (
            <AssigneeAvatars users={task.assignees} max={3} />
          )}

          {task.due_date && (
            <span
              className={cn(
                'text-xs',
                isOverdue ? 'text-red-500 font-medium' : 'text-muted-foreground'
              )}
            >
              {format(parseISO(task.due_date), 'd MMM', { locale: es })}
            </span>
          )}

          {/* Edit button */}
          <button
            onClick={() => setEditing(true)}
            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-primary hover:bg-muted transition-colors"
            title="Editar tarea"
          >
            <Pencil size={12} />
          </button>

          {/* Move to phase (C-1). Hidden when there is nowhere to move to:
              a project with no phases, or a task alone in the only one. */}
          {moveTargets.length > 0 && (
            <button
              ref={moveButtonRef}
              onClick={openMoveMenu}
              disabled={moving}
              title={moving ? 'Moviendo…' : 'Mover a otra fase'}
              className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-primary hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <FolderInput size={12} />
            </button>
          )}
          {moveMenu}

          {/* Reportar bug / deuda / pregunta desde esta tarea. Etapa 2,
              sesión 1M — origin_type siempre 'task' acá. */}
          <RowActionMenu
            title="Crear emergente desde esta tarea"
            menuLabel="Crear desde esta tarea"
            items={buildOriginMenuItems(setPending, 'task', task.id, taskCode ?? task.title)}
          />

          {/* Delete button */}
          <button
            onClick={handleDelete}
            disabled={task.subtasks.length > 0}
            title={
              task.subtasks.length > 0
                ? 'Elimina las subtareas primero'
                : 'Eliminar tarea'
            }
            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-red-500 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Subtasks panel */}
      {expanded && (
        <div className="border-t border-border divide-y-0 bg-muted/10">
          {task.subtasks.map((sub) => (
            <SubtaskRow
              key={sub.id}
              subtask={sub}
              parentCode={taskCode}
              users={users}
              projectId={projectId}
              onRefresh={onRefresh}
              originCounts={originCounts}
            />
          ))}

          {showNewSubtask ? (
            <NewSubtaskRow
              taskId={task.id}
              projectId={projectId}
              users={users}
              onSaved={() => {
                setShowNewSubtask(false);
                onRefresh();
              }}
              onCancel={() => setShowNewSubtask(false)}
            />
          ) : (
            <button
              onClick={() => setShowNewSubtask(true)}
              className="flex w-full items-center gap-1.5 px-5 py-2 text-xs text-muted-foreground hover:text-primary hover:bg-muted/30 transition-colors border-t border-border"
            >
              <Plus size={11} />
              Nueva subtarea
            </button>
          )}
        </div>
      )}

      {/* Show subtask area button when not expanded */}
      {!expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="flex w-full items-center gap-1.5 px-4 py-1.5 text-xs text-muted-foreground hover:text-primary hover:bg-muted/20 transition-colors border-t border-border"
        >
          <Plus size={11} />
          {subtasksTotal > 0
            ? `${subtasksTotal} subtarea${subtasksTotal > 1 ? 's' : ''} — expandir`
            : 'Nueva subtarea'}
        </button>
      )}
    </div>
  );
}
