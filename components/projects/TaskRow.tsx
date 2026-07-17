'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronRight,
  AlertOctagon,
  Trash2,
  Save,
  X,
  Plus,
  Clock,
  Pencil,
} from 'lucide-react';
import { format, parseISO, isPast, isToday } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { StatusBadge } from './StatusBadge';
import { PriorityBadge } from './PriorityBadge';
import { ProgressBar } from './ProgressBar';
import { AssigneeSelector, AssigneeAvatars } from './AssigneeSelector';
import {
  updateProjectTask,
  deleteProjectTask,
  createProjectSubtask,
  updateProjectSubtask,
  deleteProjectSubtask,
} from '@/src/lib/supabase/project-task-actions';
import type {
  TaskWithFullRelations,
  SubtaskWithAssignees,
  DbTask,
  DbSubtask,
  DbUser,
} from '@/src/lib/supabase/types';

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const TASK_STATUSES: { value: DbTask['status']; label: string }[] = [
  { value: 'todo', label: 'Por hacer' },
  { value: 'in_progress', label: 'En progreso' },
  { value: 'in_review', label: 'En revisión' },
  { value: 'done', label: 'Finalizada' },
  { value: 'blocked', label: 'Bloqueada' },
];

const TASK_PRIORITIES: { value: DbTask['priority']; label: string }[] = [
  { value: 'low', label: 'Baja' },
  { value: 'medium', label: 'Media' },
  { value: 'high', label: 'Alta' },
  { value: 'critical', label: 'Crítica' },
];

// ─────────────────────────────────────────────
// SubtaskRow
// ─────────────────────────────────────────────

type SubtaskRowProps = {
  subtask: SubtaskWithAssignees;
  users: Pick<DbUser, 'id' | 'name'>[];
  projectId: number;
  onRefresh: () => void;
};

function SubtaskRow({ subtask, users, projectId, onRefresh }: SubtaskRowProps) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    title: subtask.title,
    status: subtask.status,
    priority: subtask.priority,
    due_date: subtask.due_date ?? '',
    assigneeIds: subtask.assignees.map((a) => a.id),
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

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
      },
      form.assigneeIds
    );
    setSaving(false);
    if (!error) {
      setEditing(false);
      startTransition(() => router.refresh());
    } else {
      setSaveError(error);
    }
  }

  async function handleDelete() {
    if (!confirm(`¿Eliminar la subtarea "${subtask.title}"?`)) return;
    const { error } = await deleteProjectSubtask(subtask.id, projectId);
    if (!error) {
      onRefresh();
      startTransition(() => router.refresh());
    }
  }

  async function toggleComplete() {
    const newStatus: DbSubtask['status'] = subtask.completed ? 'todo' : 'done';
    startTransition(async () => {
      await updateProjectSubtask(
        subtask.id,
        projectId,
        { status: newStatus },
        subtask.assignees.map((a) => a.id)
      );
      router.refresh();
    });
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
        {saveError && (
          <p className="px-5 pb-2 text-[10px] text-red-600">{saveError}</p>
        )}
      </div>
    );
  }

  return (
    <div className="group flex items-center gap-3 px-5 py-2.5 border-t border-border hover:bg-muted/20 transition-colors">
      {/* Checkbox quick-complete */}
      <button
        onClick={toggleComplete}
        className={cn(
          'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
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

      {/* Title */}
      <span
        onClick={() => setEditing(true)}
        className={cn(
          'flex-1 min-w-0 cursor-pointer text-xs select-none truncate',
          subtask.completed && 'line-through text-muted-foreground'
        )}
      >
        {subtask.title}
      </span>

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
    assigneeIds: [] as number[],
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

  async function save() {
    if (!form.title.trim()) return;
    setSaving(true);
    setSaveError(null);
    const { error } = await createProjectSubtask(
      taskId,
      projectId,
      { title: form.title, status: form.status, priority: form.priority, due_date: form.due_date || null },
      form.assigneeIds
    );
    setSaving(false);
    if (!error) {
      onSaved();
      startTransition(() => router.refresh());
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
    {saveError && (
      <p className="px-5 pb-2 text-[10px] text-red-600">{saveError}</p>
    )}
    </div>
  );
}

// ─────────────────────────────────────────────
// TaskRow (main export)
// ─────────────────────────────────────────────

type TaskRowProps = {
  task: TaskWithFullRelations;
  users: Pick<DbUser, 'id' | 'name'>[];
  projectId: number;
  onDelete: (taskId: number) => void;
};

export function TaskRow({ task, users, projectId, onDelete }: TaskRowProps) {
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
    assigneeIds: task.assignees.map((a) => a.id),
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

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
      },
      form.assigneeIds
    );
    setSaving(false);
    if (!error) {
      setEditing(false);
      startTransition(() => router.refresh());
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
      startTransition(() => router.refresh());
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
              users={users}
              projectId={projectId}
              onRefresh={() => startTransition(() => router.refresh())}
            />
          ))}

          {showNewSubtask ? (
            <NewSubtaskRow
              taskId={task.id}
              projectId={projectId}
              users={users}
              onSaved={() => setShowNewSubtask(false)}
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
