import { cn } from '@/lib/utils';
import type { DbProject } from '@/src/lib/supabase/types';
import { TASK_PRIORITIES } from '@/src/lib/task-constants';

type Priority = DbProject['priority'];

const priorityLabels: Record<Priority, string> = Object.fromEntries(
  TASK_PRIORITIES.map((p) => [p.value, p.label])
) as Record<Priority, string>;

const priorityClassName: Record<Priority, string> = {
  low:      'bg-slate-100 text-slate-500',
  medium:   'bg-blue-100 text-blue-600',
  high:     'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
};

export function PriorityBadge({ priority, className }: { priority: Priority; className?: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', priorityClassName[priority], className)}>
      {priorityLabels[priority]}
    </span>
  );
}
