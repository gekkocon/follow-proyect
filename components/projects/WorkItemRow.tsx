'use client';

import { useState } from 'react';
import { ChevronRight, Pencil, Trash2, Save, X, Plus, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AssigneeSelector, AssigneeAvatars } from './AssigneeSelector';
import { PriorityBadge } from './PriorityBadge';
import { createWorkItem, updateWorkItem, deleteWorkItem } from '@/src/lib/supabase/work-item-actions';
import type { CreateWorkItemInput } from '@/src/lib/supabase/work-item-schema';
import { TASK_PRIORITIES } from '@/src/lib/task-constants';
import type {
  WorkItemType,
  WorkItemStatus,
  WorkItemSeverity,
  WorkItemImpact,
  WorkItemWithAssignees,
  ChecklistItem,
  DbUser,
  DbPhase,
  DbWorkItem,
} from '@/src/lib/supabase/types';

// -----------------------------------------------------------------
// Local labels — work_item_status/severity/impact are not part of any
// enum StatusBadge/PriorityBadge already cover, so they get their own
// small maps here instead of widening those shared components.
// -----------------------------------------------------------------

const STATUS_OPTIONS: { value: WorkItemStatus; label: string; className: string }[] = [
  { value: 'open', label: 'Abierto', className: 'bg-slate-100 text-slate-600' },
  { value: 'in_progress', label: 'En progreso', className: 'bg-blue-100 text-blue-700' },
  { value: 'awaiting_decision', label: 'Esperando decisión', className: 'bg-purple-100 text-purple-700' },
  { value: 'resolved', label: 'Resuelto', className: 'bg-green-100 text-green-700' },
  { value: 'discarded', label: 'Descartado', className: 'bg-red-100 text-red-700' },
];

const SEVERITY_LABELS: Record<WorkItemSeverity, string> = {
  minor: 'Menor',
  major: 'Mayor',
  blocker: 'Bloqueante',
};

const IMPACT_LABELS: Record<WorkItemImpact, string> = {
  low: 'Bajo',
  medium: 'Medio',
  high: 'Alto',
};

function statusOption(status: WorkItemStatus) {
  return STATUS_OPTIONS.find((s) => s.value === status) ?? STATUS_OPTIONS[0];
}

// -----------------------------------------------------------------
// ChecklistEditor — mini-editor over the jsonb `checklist` column.
// No reordering in this cycle. Every mutation writes the full array
// back via updateWorkItem, and always resends the current assignee
// ids so a checklist toggle never wipes assignments (same defensive
// pattern as toggleComplete in SubtaskRow).
// -----------------------------------------------------------------

function ChecklistEditor({
  workItemId,
  assigneeIds,
  checklist,
  onRefresh,
}: {
  workItemId: number;
  assigneeIds: number[];
  checklist: ChecklistItem[];
  onRefresh: () => void;
}) {
  const [newText, setNewText] = useState('');
  const [saving, setSaving] = useState(false);

  async function persist(next: ChecklistItem[]) {
    setSaving(true);
    await updateWorkItem({ id: workItemId, checklist: next, assigneeIds });
    setSaving(false);
    onRefresh();
  }

  function addItem() {
    if (!newText.trim()) return;
    const next: ChecklistItem[] = [
      ...checklist,
      {
        id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
        text: newText.trim(),
        done: false,
        order: checklist.length,
      },
    ];
    setNewText('');
    persist(next);
  }

  function toggleItem(id: string) {
    persist(checklist.map((c) => (c.id === id ? { ...c, done: !c.done } : c)));
  }

  function removeItem(id: string) {
    persist(checklist.filter((c) => c.id !== id));
  }

  return (
    <div className="space-y-1.5">
      {checklist.map((c) => (
        <div key={c.id} className="flex items-center gap-2 text-xs">
          <button
            onClick={() => toggleItem(c.id)}
            className={cn(
              'flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border transition-colors',
              c.done ? 'bg-green-500 border-green-500 text-white' : 'border-border bg-white hover:border-primary'
            )}
          >
            {c.done && <Check size={9} strokeWidth={3} />}
          </button>
          <span className={cn('flex-1 min-w-0 truncate', c.done && 'line-through text-muted-foreground')}>
            {c.text}
          </span>
          <button
            onClick={() => removeItem(c.id)}
            className="shrink-0 text-muted-foreground hover:text-red-500"
            title="Quitar ítem"
          >
            <X size={11} />
          </button>
        </div>
      ))}
      <div className="flex items-center gap-1.5">
        <input
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') addItem();
          }}
          placeholder="Agregar ítem…"
          className="flex-1 min-w-0 rounded-md border border-border px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary bg-white"
        />
        <button
          onClick={addItem}
          disabled={saving || !newText.trim()}
          className="shrink-0 flex h-6 w-6 items-center justify-center rounded text-primary hover:bg-primary/10 disabled:opacity-40 transition-colors"
          title="Agregar"
        >
          <Plus size={12} />
        </button>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------
// WorkItemRow
//
// One component for bug / debt / question_rfc, driven by `type`. Also
// doubles as the "new item" form when `item` is undefined — CLAUDE.md
// §7 prefers one component with a mode over near-identical duplicates
// (the TaskRow/NewTaskRow split exists for the hierarchy, not repeated
// here on purpose: the type-specific fields would otherwise have to be
// declared twice per type).
// -----------------------------------------------------------------

type WorkItemRowProps = {
  type: WorkItemType;
  /** Undefined renders the inline "new item" form instead of a row. */
  item?: WorkItemWithAssignees;
  projectId: number;
  users: Pick<DbUser, 'id' | 'name'>[];
  phases: Pick<DbPhase, 'id' | 'code' | 'name'>[];
  canManage: boolean;
  /** Called after a successful edit-save or delete on an existing item. */
  onRefresh: () => void;
  /** New-item mode only: called after a successful create. */
  onSaved?: () => void;
  /** New-item mode only: called on cancel. */
  onCancel?: () => void;
};

type FormState = {
  title: string;
  description: string;
  priority: DbWorkItem['priority'];
  status: WorkItemStatus;
  assigneeIds: number[];
  severity: WorkItemSeverity | '';
  environment: string;
  version: string;
  reproduction_steps: string;
  expected_behavior: string;
  actual_behavior: string;
  resolution: string;
  impact: WorkItemImpact | '';
  proposed_solution: string;
  estimated_effort: string;
  target_phase_id: number | '';
  options: string;
  recommendation: string;
  final_decision: string;
};

function buildFormState(item: WorkItemWithAssignees | undefined): FormState {
  return {
    title: item?.title ?? '',
    description: item?.description ?? '',
    priority: item?.priority ?? 'medium',
    status: item?.status ?? 'open',
    assigneeIds: item?.assignees.map((a) => a.id) ?? [],
    severity: item?.severity ?? '',
    environment: item?.environment ?? '',
    version: item?.version ?? '',
    reproduction_steps: item?.reproduction_steps ?? '',
    expected_behavior: item?.expected_behavior ?? '',
    actual_behavior: item?.actual_behavior ?? '',
    resolution: item?.resolution ?? '',
    impact: item?.impact ?? '',
    proposed_solution: item?.proposed_solution ?? '',
    estimated_effort: item?.estimated_effort ?? '',
    target_phase_id: item?.target_phase_id ?? '',
    options: item?.options?.join('\n') ?? '',
    recommendation: item?.recommendation ?? '',
    final_decision: item?.final_decision ?? '',
  };
}

export function WorkItemRow({
  type,
  item,
  projectId,
  users,
  phases,
  canManage,
  onRefresh,
  onSaved,
  onCancel,
}: WorkItemRowProps) {
  const isNew = !item;
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [form, setForm] = useState<FormState>(() => buildFormState(item));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  function cancelForm() {
    if (isNew) {
      onCancel?.();
    } else {
      setForm(buildFormState(item));
      setEditing(false);
    }
  }

  async function save() {
    if (!form.title.trim()) return;
    setSaving(true);
    setSaveError(null);

    const base = {
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      priority: form.priority,
      assigneeIds: form.assigneeIds,
    };

    if (isNew) {
      let payload: CreateWorkItemInput;
      if (type === 'bug') {
        payload = {
          ...base,
          project_id: projectId,
          type: 'bug',
          severity: form.severity || undefined,
          environment: form.environment.trim() || undefined,
          version: form.version.trim() || undefined,
          reproduction_steps: form.reproduction_steps.trim() || undefined,
          expected_behavior: form.expected_behavior.trim() || undefined,
          actual_behavior: form.actual_behavior.trim() || undefined,
        };
      } else if (type === 'debt') {
        payload = {
          ...base,
          project_id: projectId,
          type: 'debt',
          impact: form.impact || undefined,
          proposed_solution: form.proposed_solution.trim() || undefined,
          estimated_effort: form.estimated_effort.trim() || undefined,
          target_phase_id: form.target_phase_id || undefined,
        };
      } else {
        payload = {
          ...base,
          project_id: projectId,
          type: 'question_rfc',
          options: form.options
            .split('\n')
            .map((o) => o.trim())
            .filter(Boolean),
          recommendation: form.recommendation.trim() || undefined,
        };
      }
      const { error } = await createWorkItem(payload);
      setSaving(false);
      if (error) {
        setSaveError(error);
        return;
      }
      onSaved?.();
      return;
    }

    const { error } = await updateWorkItem({
      id: item.id,
      ...base,
      status: form.status,
      ...(type === 'bug'
        ? {
            severity: form.severity || undefined,
            environment: form.environment.trim() || undefined,
            version: form.version.trim() || undefined,
            reproduction_steps: form.reproduction_steps.trim() || undefined,
            expected_behavior: form.expected_behavior.trim() || undefined,
            actual_behavior: form.actual_behavior.trim() || undefined,
            resolution: form.resolution.trim() || undefined,
          }
        : {}),
      ...(type === 'debt'
        ? {
            impact: form.impact || undefined,
            proposed_solution: form.proposed_solution.trim() || undefined,
            estimated_effort: form.estimated_effort.trim() || undefined,
            target_phase_id: form.target_phase_id || undefined,
          }
        : {}),
      ...(type === 'question_rfc'
        ? {
            options: form.options
              .split('\n')
              .map((o) => o.trim())
              .filter(Boolean),
            recommendation: form.recommendation.trim() || undefined,
            final_decision: form.final_decision.trim() || undefined,
          }
        : {}),
    });
    setSaving(false);
    if (error) {
      setSaveError(error);
      return;
    }
    setEditing(false);
    onRefresh();
  }

  async function handleDelete() {
    if (!item) return;
    if (!confirm(`¿Eliminar "${item.code} — ${item.title}"?`)) return;
    const { error } = await deleteWorkItem(item.id);
    if (error) {
      alert(error);
      return;
    }
    onRefresh();
  }

  if (isNew || editing) {
    return (
      <div className={cn('flex flex-col border-t border-border', isNew ? 'bg-blue-50/40' : 'bg-primary/5')}>
        <div className="flex items-center gap-2 px-4 py-2.5 flex-wrap">
          <input
            autoFocus
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            className="flex-1 min-w-[160px] rounded-md border border-border px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary bg-white"
            placeholder="Título…"
            onKeyDown={(e) => {
              if (e.key === 'Enter') save();
              if (e.key === 'Escape') cancelForm();
            }}
          />

          <select
            value={form.priority}
            onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as DbWorkItem['priority'] }))}
            className="rounded-md border border-border px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {TASK_PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>

          {!isNew && (
            <select
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as WorkItemStatus }))}
              className="rounded-md border border-border px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          )}

          <AssigneeSelector
            users={users}
            selectedIds={form.assigneeIds}
            onChange={(ids) => setForm((f) => ({ ...f, assigneeIds: ids }))}
            placeholder="Responsables"
          />

          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={save}
              disabled={saving || !form.title.trim()}
              className="flex h-6 w-6 items-center justify-center rounded text-green-600 hover:bg-green-100 disabled:opacity-40 transition-colors"
              title="Guardar"
            >
              <Save size={12} />
            </button>
            <button
              onClick={cancelForm}
              className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted transition-colors"
              title="Cancelar"
            >
              <X size={12} />
            </button>
          </div>
        </div>

        <div className="px-4 pb-2.5">
          <textarea
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            className="w-full rounded-md border border-border px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-primary resize-y"
            placeholder="Descripción (opcional)…"
            rows={2}
          />
        </div>

        {/* Type-specific fields */}
        {type === 'bug' && (
          <div className="px-4 pb-2.5 grid grid-cols-2 gap-2">
            <select
              value={form.severity}
              onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value as WorkItemSeverity | '' }))}
              className="rounded-md border border-border px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">Severidad…</option>
              {(Object.keys(SEVERITY_LABELS) as WorkItemSeverity[]).map((s) => (
                <option key={s} value={s}>
                  {SEVERITY_LABELS[s]}
                </option>
              ))}
            </select>
            <input
              value={form.environment}
              onChange={(e) => setForm((f) => ({ ...f, environment: e.target.value }))}
              placeholder="Entorno (ej. producción)"
              className="rounded-md border border-border px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <input
              value={form.version}
              onChange={(e) => setForm((f) => ({ ...f, version: e.target.value }))}
              placeholder="Versión"
              className="rounded-md border border-border px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <textarea
              value={form.reproduction_steps}
              onChange={(e) => setForm((f) => ({ ...f, reproduction_steps: e.target.value }))}
              placeholder="Pasos para reproducir…"
              rows={2}
              className="col-span-2 rounded-md border border-border px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-primary resize-y"
            />
            <textarea
              value={form.expected_behavior}
              onChange={(e) => setForm((f) => ({ ...f, expected_behavior: e.target.value }))}
              placeholder="Comportamiento esperado…"
              rows={2}
              className="rounded-md border border-border px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-primary resize-y"
            />
            <textarea
              value={form.actual_behavior}
              onChange={(e) => setForm((f) => ({ ...f, actual_behavior: e.target.value }))}
              placeholder="Comportamiento real…"
              rows={2}
              className="rounded-md border border-border px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-primary resize-y"
            />
            {!isNew && (
              <textarea
                value={form.resolution}
                onChange={(e) => setForm((f) => ({ ...f, resolution: e.target.value }))}
                placeholder="Resolución (opcional)…"
                rows={2}
                className="col-span-2 rounded-md border border-border px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-primary resize-y"
              />
            )}
          </div>
        )}

        {type === 'debt' && (
          <div className="px-4 pb-2.5 grid grid-cols-2 gap-2">
            <select
              value={form.impact}
              onChange={(e) => setForm((f) => ({ ...f, impact: e.target.value as WorkItemImpact | '' }))}
              className="rounded-md border border-border px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">Impacto…</option>
              {(Object.keys(IMPACT_LABELS) as WorkItemImpact[]).map((i) => (
                <option key={i} value={i}>
                  {IMPACT_LABELS[i]}
                </option>
              ))}
            </select>
            <input
              value={form.estimated_effort}
              onChange={(e) => setForm((f) => ({ ...f, estimated_effort: e.target.value }))}
              placeholder="Esfuerzo estimado"
              className="rounded-md border border-border px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <select
              value={form.target_phase_id}
              onChange={(e) =>
                setForm((f) => ({ ...f, target_phase_id: e.target.value ? Number(e.target.value) : '' }))
              }
              className="col-span-2 rounded-md border border-border px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">Fase objetivo (opcional)…</option>
              {phases.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.name}
                </option>
              ))}
            </select>
            <textarea
              value={form.proposed_solution}
              onChange={(e) => setForm((f) => ({ ...f, proposed_solution: e.target.value }))}
              placeholder="Solución propuesta…"
              rows={2}
              className="col-span-2 rounded-md border border-border px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-primary resize-y"
            />
          </div>
        )}

        {type === 'question_rfc' && (
          <div className="px-4 pb-2.5 space-y-2">
            <textarea
              value={form.options}
              onChange={(e) => setForm((f) => ({ ...f, options: e.target.value }))}
              placeholder="Opciones a evaluar, una por línea…"
              rows={2}
              className="w-full rounded-md border border-border px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-primary resize-y"
            />
            <textarea
              value={form.recommendation}
              onChange={(e) => setForm((f) => ({ ...f, recommendation: e.target.value }))}
              placeholder="Recomendación (opcional)…"
              rows={2}
              className="w-full rounded-md border border-border px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-primary resize-y"
            />
            {!isNew && (
              <textarea
                value={form.final_decision}
                onChange={(e) => setForm((f) => ({ ...f, final_decision: e.target.value }))}
                placeholder="Decisión final (opcional)…"
                rows={2}
                className="w-full rounded-md border border-border px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-primary resize-y"
              />
            )}
          </div>
        )}

        {saveError && (
          <p className="mx-4 mb-2.5 text-[10px] text-red-600 bg-red-50 border border-red-200 rounded-md px-2 py-1">
            {saveError}
          </p>
        )}
      </div>
    );
  }

  // Display mode — item is guaranteed defined here (isNew is false).
  if (!item) return null;
  const status = statusOption(item.status);

  return (
    <div className="border-t border-border">
      <div className="group flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20 transition-colors">
        <button
          onClick={() => setExpanded((e) => !e)}
          className="shrink-0 text-muted-foreground"
          title={expanded ? 'Colapsar' : 'Expandir'}
        >
          <ChevronRight size={14} className={cn('transition-transform', expanded && 'rotate-90')} />
        </button>

        <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{item.code}</span>

        <span onClick={() => setEditing(true)} className="flex-1 min-w-0 truncate text-xs cursor-pointer">
          {item.title}
        </span>

        {item.assignees.length > 0 && <AssigneeAvatars users={item.assignees} max={2} />}

        <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium', status.className)}>
          {status.label}
        </span>

        <PriorityBadge priority={item.priority} className="text-[10px] py-0 px-1.5 shrink-0" />

        {type === 'bug' && item.severity && (
          <span className="shrink-0 rounded-full bg-red-50 text-red-600 px-2 py-0.5 text-[10px] font-medium">
            {SEVERITY_LABELS[item.severity]}
          </span>
        )}
        {type === 'debt' && item.impact && (
          <span className="shrink-0 rounded-full bg-amber-50 text-amber-700 px-2 py-0.5 text-[10px] font-medium">
            Impacto {IMPACT_LABELS[item.impact]}
          </span>
        )}

        <button
          onClick={() => setEditing(true)}
          className="opacity-0 group-hover:opacity-100 flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-primary transition-all"
          title="Editar"
        >
          <Pencil size={10} />
        </button>

        {/* Delete gate lives server-side in deleteWorkItem (canManageTeam).
            Hiding the button for non-managers here is a UX shortcut, not
            a second authorization check. */}
        {canManage && (
          <button
            onClick={handleDelete}
            className="opacity-0 group-hover:opacity-100 flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-red-500 transition-all"
            title="Eliminar"
          >
            <Trash2 size={10} />
          </button>
        )}
      </div>

      {expanded && (
        <div className="px-4 pb-3 pl-11 space-y-2 bg-muted/10 text-xs">
          {item.description && <p className="text-muted-foreground">{item.description}</p>}

          {type === 'bug' && (item.reproduction_steps || item.expected_behavior || item.actual_behavior) && (
            <div className="space-y-1">
              {item.reproduction_steps && (
                <p>
                  <strong>Pasos: </strong>
                  {item.reproduction_steps}
                </p>
              )}
              {item.expected_behavior && (
                <p>
                  <strong>Esperado: </strong>
                  {item.expected_behavior}
                </p>
              )}
              {item.actual_behavior && (
                <p>
                  <strong>Real: </strong>
                  {item.actual_behavior}
                </p>
              )}
              {item.resolution && (
                <p>
                  <strong>Resolución: </strong>
                  {item.resolution}
                </p>
              )}
            </div>
          )}

          {type === 'debt' && (item.proposed_solution || item.estimated_effort) && (
            <div className="space-y-1">
              {item.proposed_solution && (
                <p>
                  <strong>Solución propuesta: </strong>
                  {item.proposed_solution}
                </p>
              )}
              {item.estimated_effort && (
                <p>
                  <strong>Esfuerzo estimado: </strong>
                  {item.estimated_effort}
                </p>
              )}
            </div>
          )}

          {type === 'question_rfc' && (
            <div className="space-y-1">
              {item.options && item.options.length > 0 && (
                <div>
                  <strong>Opciones:</strong>
                  <ul className="list-disc list-inside">
                    {item.options.map((o, i) => (
                      <li key={i}>{o}</li>
                    ))}
                  </ul>
                </div>
              )}
              {item.recommendation && (
                <p>
                  <strong>Recomendación: </strong>
                  {item.recommendation}
                </p>
              )}
              {item.final_decision && (
                <p>
                  <strong>Decisión final: </strong>
                  {item.final_decision}
                </p>
              )}
            </div>
          )}

          <div>
            <p className="text-[10px] font-medium text-muted-foreground uppercase mb-1">Checklist</p>
            <ChecklistEditor
              workItemId={item.id}
              assigneeIds={item.assignees.map((a) => a.id)}
              checklist={item.checklist}
              onRefresh={onRefresh}
            />
          </div>
        </div>
      )}
    </div>
  );
}
