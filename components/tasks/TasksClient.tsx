'use client';

import { useState, useMemo, useCallback, useTransition, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import { isPast, parseISO, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { AlertTriangle, AlertOctagon, ChevronDown, ChevronRight, CalendarDays, CornerDownRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { updateTaskStatus } from '@/src/lib/supabase/task-actions';
import { PriorityBadge } from '@/components/projects/PriorityBadge';
import { StatusBadge } from '@/components/projects/StatusBadge';
import { AssigneeAvatars } from '@/components/projects/AssigneeSelector';
import { TaskStatusSelect } from './TaskStatusSelect';
import { TaskFilters, type TaskFiltersState } from './TaskFilters';
import type { DbTask, DbUser } from '@/src/lib/supabase/types';
import type { TaskListItem, SubtaskListItem } from '@/app/(dashboard)/tasks/page';

type Props = {
  initialTasks: TaskListItem[];
  users: Pick<DbUser, 'id' | 'name'>[];
  error?: string | null;
};

export function TasksClient({ initialTasks, users, error }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [tasks, setTasks] = useState<TaskListItem[]>(initialTasks);
  const [filters, setFilters] = useState<TaskFiltersState>({ status: '', priority: '', assigneeId: '' });
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const filteredTasks = useMemo(() => tasks.filter((t) => {
    if (filters.status && t.status !== filters.status) return false;
    if (filters.priority && t.priority !== filters.priority) return false;
    if (filters.assigneeId && !t.assignees.some((a) => String(a.id) === filters.assigneeId)) return false;
    return true;
  }), [tasks, filters]);

  const handleStatusUpdate = useCallback(async (taskId: number, newStatus: DbTask['status']) => {
    setTasks((prev) => prev.map((t) =>
      t.id === taskId ? { ...t, status: newStatus, is_blocked: newStatus === 'blocked' } : t
    ));
    const result = await updateTaskStatus(taskId, newStatus);
    if (result.error) { setTasks(initialTasks); }
    else { startTransition(() => router.refresh()); }
  }, [initialTasks, router]);

  function toggleExpand(id: number) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }

  function goToProject(projectId: number | null) {
    if (projectId) router.push(`/projects/${projectId}`);
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Tareas</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Vista global de todas las tareas.</p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <strong>Error al cargar tareas:</strong> {error}
        </div>
      )}

      <TaskFilters filters={filters} onChange={setFilters} users={users} totalCount={tasks.length} filteredCount={filteredTasks.length} />

      {filteredTasks.length === 0 ? (
        <div className="rounded-xl border border-border bg-white p-16 text-center text-sm text-muted-foreground">
          {tasks.length === 0 ? 'No hay tareas registradas.' : 'Ninguna tarea coincide con los filtros.'}
        </div>
      ) : (
        <>
          {/* ── Mobile cards ────────────────────────────────────────────── */}
          <div className="space-y-2 md:hidden">
            {filteredTasks.map((task) => {
              const isOverdue = task.due_date && task.status !== 'done' && isPast(parseISO(task.due_date));
              const isBlocked = task.is_blocked || task.status === 'blocked';
              const hasSubtasks = task.subtasks.length > 0;
              const expanded = expandedIds.has(task.id);

              return (
                <div
                  key={task.id}
                  onClick={() => goToProject(task.project_id)}
                  className={cn(
                    'rounded-xl border border-border bg-white p-4 shadow-sm space-y-3',
                    task.project_id && 'cursor-pointer active:bg-muted/30',
                    task.status === 'done' && 'opacity-60'
                  )}
                >
                  {/* Title row */}
                  <div className="flex items-start gap-2 justify-between">
                    <div className="flex items-start gap-1.5 min-w-0 flex-1">
                      {isBlocked && <AlertOctagon size={13} className="mt-0.5 shrink-0 text-red-500" />}
                      <span className={cn('text-sm font-medium text-foreground', task.status === 'done' && 'line-through text-muted-foreground')}>
                        {task.title}
                      </span>
                    </div>
                    <PriorityBadge priority={task.priority} className="shrink-0" />
                  </div>

                  {/* Project */}
                  {task.project && (
                    <p className="text-xs text-muted-foreground">{task.project.name}</p>
                  )}

                  {/* Status + date */}
                  <div className="flex items-center justify-between gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
                    <TaskStatusSelect taskId={task.id} status={task.status} onUpdate={handleStatusUpdate} />
                    {task.due_date && (
                      <span className={cn('inline-flex items-center gap-1 text-xs', isOverdue ? 'text-red-600 font-medium' : 'text-muted-foreground')}>
                        {isOverdue && <AlertTriangle size={11} />}
                        <CalendarDays size={11} />
                        {format(parseISO(task.due_date), 'd MMM yyyy', { locale: es })}
                      </span>
                    )}
                  </div>

                  {/* Assignees */}
                  {task.assignees.length > 0 && (
                    <div className="flex items-center gap-2">
                      <AssigneeAvatars users={task.assignees} max={3} />
                      <span className="text-xs text-muted-foreground truncate">
                        {task.assignees.map((a) => a.name).join(', ')}
                      </span>
                    </div>
                  )}

                  {/* Blocked reason */}
                  {isBlocked && task.blocked_reason && (
                    <p className="text-xs text-red-700 bg-red-50 rounded-lg px-3 py-2">{task.blocked_reason}</p>
                  )}

                  {/* Subtasks toggle + list */}
                  {hasSubtasks && (
                    <div className="pt-1 border-t border-border" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => toggleExpand(task.id)}
                        className="flex items-center gap-1 text-xs text-muted-foreground font-medium min-h-[44px] w-full"
                      >
                        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        {task.subtasks.length} subtarea{task.subtasks.length > 1 ? 's' : ''}
                        {' · '}
                        {task.subtasks.filter((s) => s.status === 'done').length}/{task.subtasks.length} completadas
                      </button>
                      {expanded && (
                        <div className="space-y-2 pt-1">
                          {task.subtasks.map((sub) => (
                            <SubtaskCard key={sub.id} subtask={sub} />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* ── Desktop table ────────────────────────────────────────────── */}
          <div className="hidden md:block rounded-xl border border-border bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-left text-xs font-medium text-muted-foreground">
                    <th className="px-4 py-3 w-6" />
                    <th className="px-4 py-3">Tarea</th>
                    <th className="px-4 py-3 hidden md:table-cell">Proyecto</th>
                    <th className="px-4 py-3 hidden lg:table-cell">Responsable</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3 hidden sm:table-cell">Prioridad</th>
                    <th className="px-4 py-3 hidden md:table-cell">Fecha</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredTasks.map((task) => {
                    const isOverdue = task.due_date && task.status !== 'done' && isPast(parseISO(task.due_date));
                    const hasBlockedReason = (task.is_blocked || task.status === 'blocked') && task.blocked_reason;
                    const hasSubtasks = task.subtasks.length > 0;
                    const isExpandable = hasBlockedReason || hasSubtasks;
                    const expanded = expandedIds.has(task.id);
                    const subtasksDone = task.subtasks.filter((s) => s.status === 'done').length;
                    const clickable = !!task.project_id;

                    return (
                      <Fragment key={task.id}>
                        <tr
                          onClick={() => goToProject(task.project_id)}
                          className={cn(
                            'group transition-colors hover:bg-muted/30',
                            clickable && 'cursor-pointer',
                            task.status === 'done' && 'opacity-60'
                          )}
                        >
                          <td className="px-4 py-3 w-6" onClick={(e) => e.stopPropagation()}>
                            {isExpandable ? (
                              <button onClick={() => toggleExpand(task.id)} className="text-muted-foreground hover:text-foreground">
                                {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                              </button>
                            ) : null}
                          </td>
                          <td className="px-4 py-3 max-w-[280px]">
                            <div className="flex items-start gap-1.5 min-w-0">
                              {(task.is_blocked || task.status === 'blocked') && <AlertOctagon size={13} className="mt-0.5 shrink-0 text-red-500" />}
                              <span className={cn('truncate font-medium text-foreground group-hover:text-primary transition-colors', task.status === 'done' && 'line-through text-muted-foreground')}>
                                {task.title}
                              </span>
                            </div>
                            <div className="mt-0.5 flex flex-wrap gap-x-2 items-center md:hidden">
                              {task.project && <span className="text-xs text-muted-foreground">{task.project.name}</span>}
                              {task.assignees.length > 0 && (
                                <span className="text-xs text-muted-foreground/70">· {task.assignees.map((a) => a.name).join(', ')}</span>
                              )}
                            </div>
                            {hasSubtasks && (
                              <p className="mt-0.5 text-[11px] text-muted-foreground">
                                {subtasksDone}/{task.subtasks.length} subtareas completadas
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell max-w-[160px]">
                            {task.project ? <span className="truncate text-muted-foreground text-xs">{task.project.name}</span> : <span className="text-muted-foreground/50 text-xs">—</span>}
                          </td>
                          <td className="px-4 py-3 hidden lg:table-cell">
                            {task.assignees.length > 0 ? (
                              <div className="flex items-center gap-2">
                                <AssigneeAvatars users={task.assignees} max={3} />
                                <span className="text-xs text-muted-foreground truncate max-w-[100px]">
                                  {task.assignees.length === 1 ? task.assignees[0].name : `${task.assignees.length} responsables`}
                                </span>
                              </div>
                            ) : <span className="text-muted-foreground/50 text-xs">—</span>}
                          </td>
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            <TaskStatusSelect taskId={task.id} status={task.status} onUpdate={handleStatusUpdate} />
                          </td>
                          <td className="px-4 py-3 hidden sm:table-cell">
                            <PriorityBadge priority={task.priority} />
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell">
                            {task.due_date ? (
                              <span className={cn('inline-flex items-center gap-1 text-xs', isOverdue ? 'text-red-600 font-medium' : 'text-muted-foreground')}>
                                {isOverdue && <AlertTriangle size={11} />}
                                {format(parseISO(task.due_date), 'd MMM yyyy', { locale: es })}
                              </span>
                            ) : <span className="text-muted-foreground/50 text-xs">—</span>}
                          </td>
                        </tr>

                        {/* Blocked reason — own row */}
                        {expanded && hasBlockedReason && (
                          <tr className="bg-red-50/50">
                            <td />
                            <td colSpan={6} className="px-4 py-2">
                              <div className="flex items-start gap-2 text-xs text-red-700">
                                <AlertOctagon size={12} className="mt-0.5 shrink-0" />
                                <span>{task.blocked_reason}</span>
                              </div>
                            </td>
                          </tr>
                        )}

                        {/* Subtasks — one <tr> per subtask, columns aligned with parent table */}
                        {expanded && hasSubtasks && task.subtasks.map((sub) => {
                          const subOverdue = sub.due_date && sub.status !== 'done' && isPast(parseISO(sub.due_date));
                          return (
                            <tr
                              key={sub.id}
                              onClick={() => goToProject(task.project_id)}
                              className={cn('bg-muted/10 text-muted-foreground hover:bg-muted/20 transition-colors', clickable && 'cursor-pointer')}
                            >
                              <td className="px-4 py-2 w-6" />
                              <td className="px-4 py-2 max-w-[280px]">
                                <div className="flex items-center gap-1.5 min-w-0 pl-3">
                                  <CornerDownRight size={12} className="shrink-0 text-muted-foreground/50" />
                                  <span className={cn('truncate text-xs', sub.status === 'done' && 'line-through text-muted-foreground/70')}>
                                    {sub.title}
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-2 hidden md:table-cell">
                                <span className="text-muted-foreground/40 text-xs">—</span>
                              </td>
                              <td className="px-4 py-2 hidden lg:table-cell">
                                {sub.assignees.length > 0 ? (
                                  <AssigneeAvatars users={sub.assignees} max={2} />
                                ) : (
                                  <span className="text-muted-foreground/40 text-xs">—</span>
                                )}
                              </td>
                              <td className="px-4 py-2">
                                <StatusBadge status={sub.status} className="text-[10px] py-0 px-1.5" />
                              </td>
                              <td className="px-4 py-2 hidden sm:table-cell">
                                <PriorityBadge priority={sub.priority} className="text-[10px] py-0 px-1.5" />
                              </td>
                              <td className="px-4 py-2 hidden md:table-cell">
                                {sub.due_date ? (
                                  <span className={cn('text-xs', subOverdue ? 'text-red-500 font-medium' : 'text-muted-foreground')}>
                                    {format(parseISO(sub.due_date), 'd MMM yyyy', { locale: es })}
                                  </span>
                                ) : <span className="text-muted-foreground/40 text-xs">—</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Subtask card — mobile ─────────────────────────────────────────────────
function SubtaskCard({ subtask }: { subtask: SubtaskListItem }) {
  const isOverdue = subtask.due_date && subtask.status !== 'done' && isPast(parseISO(subtask.due_date));

  return (
    <div className="rounded-lg border border-border bg-muted/20 px-3 py-2 space-y-1.5">
      <div className="flex items-start gap-1.5">
        <CornerDownRight size={12} className="mt-0.5 shrink-0 text-muted-foreground/50" />
        <span className={cn('flex-1 min-w-0 text-xs font-medium', subtask.status === 'done' && 'line-through text-muted-foreground')}>
          {subtask.title}
        </span>
      </div>
      <div className="flex items-center gap-2 flex-wrap pl-[18px]">
        <StatusBadge status={subtask.status} className="text-[10px] py-0 px-1.5" />
        <PriorityBadge priority={subtask.priority} className="text-[10px] py-0 px-1.5" />
        {subtask.due_date && (
          <span className={cn('inline-flex items-center gap-1 text-[11px]', isOverdue ? 'text-red-600 font-medium' : 'text-muted-foreground')}>
            <CalendarDays size={10} />
            {format(parseISO(subtask.due_date), 'd MMM', { locale: es })}
          </span>
        )}
        {subtask.assignees.length > 0 && (
          <div className="flex items-center gap-1">
            <AssigneeAvatars users={subtask.assignees} max={2} />
            <span className="text-[11px] text-muted-foreground">
              {subtask.assignees.map((a) => a.name).join(', ')}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
