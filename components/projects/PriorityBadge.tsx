import { cn } from '@/lib/utils';
import type { DbProject } from '@/src/lib/supabase/types';

type Priority = DbProject['priority'];

const priorityConfig: Record<Priority, { label: string; className: string }> = {
  low:      { label: 'Baja',    className: 'bg-slate-100 text-slate-500' },
  medium:   { label: 'Media',   className: 'bg-blue-100 text-blue-600' },
  high:     { label: 'Alta',    className: 'bg-orange-100 text-orange-700' },
  critical: { label: 'Crítica', className: 'bg-red-100 text-red-700' },
};

export function PriorityBadge({ priority, className }: { priority: Priority; className?: string }) {
  const config = priorityConfig[priority];
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', config.className, className)}>
      {config.label}
    </span>
  );
}
