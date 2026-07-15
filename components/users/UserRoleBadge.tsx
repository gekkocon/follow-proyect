import { cn } from '@/lib/utils';
import type { DbUser } from '@/src/lib/supabase/types';

type Role = DbUser['role'];

const roleConfig: Record<Role, { label: string; className: string }> = {
  admin:     { label: 'Admin',           className: 'bg-purple-100 text-purple-700' },
  pm:        { label: 'Project Manager', className: 'bg-blue-100 text-blue-700' },
  developer: { label: 'Desarrollador',   className: 'bg-cyan-100 text-cyan-700' },
  designer:  { label: 'Diseñador',       className: 'bg-pink-100 text-pink-700' },
};

export function UserRoleBadge({ role, className }: { role: Role; className?: string }) {
  const config = roleConfig[role];
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', config.className, className)}>
      {config.label}
    </span>
  );
}
