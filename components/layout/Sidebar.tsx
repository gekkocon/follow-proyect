'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, FolderKanban, CheckSquare, Users, Settings, X } from 'lucide-react';
import { useBrandStore } from '@/src/store/brandStore';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/dashboard', label: 'Dashboard',    icon: LayoutDashboard },
  { href: '/projects',  label: 'Proyectos',    icon: FolderKanban },
  { href: '/tasks',     label: 'Tareas',       icon: CheckSquare },
  { href: '/users',     label: 'Usuarios',     icon: Users },
  { href: '/settings',  label: 'Configuración', icon: Settings },
];

type SidebarProps = {
  open: boolean;
  onClose: () => void;
};

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname     = usePathname();
  const orgName      = useBrandStore((s) => s.orgName);
  const logoUrl      = useBrandStore((s) => s.logoUrl);
  const primaryColor = useBrandStore((s) => s.primaryColor);

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-20 bg-black/40 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 flex w-64 flex-col bg-white border-r border-border',
          'transition-transform duration-200 ease-in-out',
          'md:static md:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo / Agency name */}
        <div className="flex h-14 md:h-16 items-center justify-between px-5 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt={orgName} className="h-7 w-auto" />
            ) : (
              <span
                className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold text-white"
                style={{ backgroundColor: primaryColor }}
              >
                {orgName.charAt(0)}
              </span>
            )}
            <span className="text-base font-semibold tracking-tight text-foreground">
              {orgName}
            </span>
          </div>

          {/* Close button — mobile only */}
          <button
            onClick={onClose}
            className="md:hidden rounded-md p-2 text-muted-foreground hover:text-foreground min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/');
            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors min-h-[44px]',
                  active
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <Icon size={17} strokeWidth={active ? 2.2 : 1.8} />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Footer label */}
        <div className="px-5 py-3 border-t border-border shrink-0">
          <p className="text-xs text-muted-foreground">v0.6 · Fase 6B</p>
        </div>
      </aside>
    </>
  );
}
