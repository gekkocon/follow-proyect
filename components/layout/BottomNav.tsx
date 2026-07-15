'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, FolderKanban, CheckSquare, Users, Settings } from 'lucide-react';
import { useAuthStore } from '@/src/store/authStore';
import { cn } from '@/lib/utils';

const ALL_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: null },
  { href: '/projects',  label: 'Proyectos',  icon: FolderKanban,   roles: null },
  { href: '/tasks',     label: 'Tareas',     icon: CheckSquare,    roles: null },
  { href: '/users',     label: 'Usuarios',   icon: Users,          roles: ['admin', 'pm'] as string[] },
  { href: '/settings',  label: 'Config.',    icon: Settings,       roles: ['admin'] as string[] },
];

export function BottomNav() {
  const pathname = usePathname();
  const userRole = useAuthStore((s) => s.user?.role);

  const items = ALL_ITEMS.filter(
    (item) => !item.roles || (userRole && item.roles.includes(userRole))
  );

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 flex h-16 items-stretch border-t border-border bg-white md:hidden safe-area-bottom">
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + '/');
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors min-h-[44px]',
              active ? 'text-primary' : 'text-muted-foreground'
            )}
          >
            <Icon size={20} strokeWidth={active ? 2.2 : 1.7} />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
