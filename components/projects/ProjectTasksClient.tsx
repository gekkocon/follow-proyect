'use client';

import { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Save, X } from 'lucide-react';
import { AssigneeSelector } from './AssigneeSelector';
import { TaskRow } from './TaskRow';
import { createProjectTask } from '@/src/lib/supabase/project-task-actions';
import type { TaskWithFullRelations, DbTask, DbUser } from '@/src/lib/supabase/types';

// ─────────────────────────────────────────────
// NewTaskRow
// ─────────────────────────────────────────────

type NewTaskRowProps = {
  projectId: number;
  users: Pick<DbUser, 'id' | 'name'>[];
  onSaved: () => void;
  onCancel: () => void;
};

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

function NewTaskRow({ projectId, users, onSaved, onCancel }: NewTaskRowProps) {
  const [form, setForm] = useState({
    title: '',
    status: 'todo' as DbTask['status'],
    priority: 'medium' as DbTask['priority'],
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
    const { error } = await createProjectTask(
      projectId,
      {
        title: form.title,
        status: form.status,
        priority: form.priority,
        due_date: form.due_date || null,
      },
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
      {saveError && (
        <p className="mx-3 mb-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-1.5">
          {saveError}
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// ProjectTasksClient
// ─────────────────────────────────────────────

type Props = {
  initialTasks: TaskWithFullRelations[];
  users: Pick<DbUser, 'id' | 'name'>[];
  projectId: number;
};

export function ProjectTasksClient({ initialTasks, users, projectId }: Props) {
  const [tasks, setTasks] = useState<TaskWithFullRelations[]>(initialTasks);
  const [showNewTask, setShowNewTask] = useState(false);

  // Sync when server re-renders after router.refresh()
  useEffect(() => {
    setTasks(initialTasks);
  }, [initialTasks]);

  function handleDelete(taskId: number) {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-foreground">
          Tareas{' '}
          <span className="text-muted-foreground font-normal text-sm">({tasks.length})</span>
        </h2>
        {!showNewTask && (
          <button
            onClick={() => setShowNewTask(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            <Plus size={14} />
            Nueva tarea
          </button>
        )}
      </div>

      {/* Task list */}
      {tasks.length === 0 && !showNewTask ? (
        <div className="rounded-xl border border-dashed border-border bg-white p-10 text-center">
          <p className="text-sm text-muted-foreground">
            No hay tareas para este proyecto.{' '}
            <button
              onClick={() => setShowNewTask(true)}
              className="text-primary hover:underline"
            >
              Crear la primera
            </button>
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              users={users}
              projectId={projectId}
              onDelete={handleDelete}
            />
          ))}

          {showNewTask && (
            <NewTaskRow
              projectId={projectId}
              users={users}
              onSaved={() => setShowNewTask(false)}
              onCancel={() => setShowNewTask(false)}
            />
          )}
        </div>
      )}
    </div>
  );
}
