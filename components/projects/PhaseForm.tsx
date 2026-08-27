'use client';

import { useState } from 'react';
import { Save, X } from 'lucide-react';
import { createPhase, updatePhase, type PhaseInput } from '@/src/lib/supabase/phase-actions';
import { TASK_STATUSES, TASK_PRIORITIES } from '@/src/lib/task-constants';
import type { PhaseWithTasks } from '@/src/lib/work-plan';
import type { DbPhase } from '@/src/lib/supabase/types';

// ─────────────────────────────────────────────
// PhaseForm
//
// One component with a `mode` prop instead of two near-identical ones, same
// criterion as ImportTasksPanel. The layout mirrors NewTaskRow on purpose: a
// phase and a task are created from the same place on screen and reading as
// two different forms would be noise.
//
// There is no assignee selector — phases have no rows in `assignments` — and
// no start_date, which tasks do not expose either.
// ─────────────────────────────────────────────

type PhaseFormProps = {
  mode: 'create' | 'edit';
  projectId: number;
  /** Required when mode === 'edit'. */
  phase?: PhaseWithTasks;
  onSaved: () => void;
  onCancel: () => void;
};

export function PhaseForm({ mode, projectId, phase, onSaved, onCancel }: PhaseFormProps) {
  const isEdit = mode === 'edit';

  // Seeded once, on mount. There is no useEffect resetting this: the parent
  // unmounts the form on cancel, so stale input cannot survive a reopen.
  const [form, setForm] = useState({
    name: phase?.name ?? '',
    status: (phase?.status ?? 'todo') as DbPhase['status'],
    priority: (phase?.priority ?? 'medium') as DbPhase['priority'],
    due_date: phase?.due_date ?? '',
    objective: phase?.objective ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function save() {
    if (!form.name.trim()) return;
    setSaving(true);
    setSaveError(null);

    const data: PhaseInput = {
      name: form.name,
      objective: form.objective.trim() || null,
      status: form.status,
      priority: form.priority,
      due_date: form.due_date || null,
    };

    const { error } =
      isEdit && phase
        ? await updatePhase(phase.id, projectId, data)
        : await createPhase(projectId, data);

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
        value={form.name}
        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        className="w-full rounded-md border border-border px-3 py-1.5 text-sm font-medium bg-white focus:outline-none focus:ring-1 focus:ring-primary"
        placeholder="Nombre de la fase…"
        onKeyDown={(e) => {
          if (e.key === 'Enter') save();
          if (e.key === 'Escape') onCancel();
        }}
      />

      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={form.status}
          onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as DbPhase['status'] }))}
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
            setForm((f) => ({ ...f, priority: e.target.value as DbPhase['priority'] }))
          }
          className="rounded-md border border-border px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-primary"
        >
          {TASK_PRIORITIES.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>

        <input
          type="date"
          value={form.due_date}
          onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
          className="rounded-md border border-border px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-primary"
        />

        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={save}
            disabled={saving || !form.name.trim()}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1 text-xs font-medium text-white hover:bg-primary/90 disabled:opacity-40 transition-colors"
          >
            <Save size={11} />
            {saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear fase'}
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
        value={form.objective}
        onChange={(e) => setForm((f) => ({ ...f, objective: e.target.value }))}
        className="w-full rounded-md border border-border px-3 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-primary resize-y"
        placeholder="Objetivo (opcional)…"
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
