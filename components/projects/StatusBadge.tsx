import { cn } from '@/lib/utils';
import type { DbProject, DbTask } from '@/src/lib/supabase/types';
import { PROJECT_STATUS_LABELS } from '@/src/lib/constants';
import { TASK_STATUSES } from '@/src/lib/task-constants';

type ProjectStatus = DbProject['status'];
type TaskStatus = DbTask['status'];
type Status = ProjectStatus | TaskStatus;

const statusLabels: Record<Status, string> = {
  ...PROJECT_STATUS_LABELS,
  ...Object.fromEntries(TASK_STATUSES.map((s) => [s.value, s.label])),
} as Record<Status, string>;

const statusClassName: Record<Status, string> = {
  planning:    'bg-slate-100 text-slate-600',
  active:      'bg-blue-100 text-blue-700',
  on_hold:     'bg-amber-100 text-amber-700',
  completed:   'bg-green-100 text-green-700',
  overdue:     'bg-red-100 text-red-700',
  todo:        'bg-slate-100 text-slate-600',
  in_progress: 'bg-blue-100 text-blue-700',
  in_review:   'bg-purple-100 text-purple-700',
  done:        'bg-green-100 text-green-700',
  blocked:     'bg-red-100 text-red-700',
};

export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', statusClassName[status], className)}>
      {statusLabels[status]}
    </span>
  );
}
