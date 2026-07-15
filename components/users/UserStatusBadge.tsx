import { cn } from '@/lib/utils';
import type { DbUser } from '@/src/lib/supabase/types';

type Status = DbUser['status'];

const statusConfig: Record<Status, { label: string; className: string; dot: string }> = {
  active:   { label: 'Activo',   className: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
  inactive: { label: 'Inactivo', className: 'bg-slate-100 text-slate-500', dot: 'bg-slate-400' },
};

export function UserStatusBadge({ status, className }: { status: Status; className?: string }) {
  const config = statusConfig[status];
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium', config.className, className)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', config.dot)} />
      {config.label}
    </span>
  );
}
