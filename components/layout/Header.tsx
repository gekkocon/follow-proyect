'use client';

import { Menu, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/src/store/authStore';
import { useBrandStore } from '@/src/store/brandStore';
import { USER_ROLE_LABELS } from '@/src/lib/constants';
import { createClient } from '@/src/lib/supabase/client';

type HeaderProps = { onMenuClick: () => void };

export function Header({ onMenuClick }: HeaderProps) {
  const router    = useRouter();
  const user      = useAuthStore((s) => s.user);
  const clearUser = useAuthStore((s) => s.clearUser);
  const orgName      = useBrandStore((s) => s.orgName);
  const logoUrl      = useBrandStore((s) => s.logoUrl);
  const primaryColor = useBrandStore((s) => s.primaryColor);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    clearUser();
    router.push('/login');
    router.refresh();
  }

  return (
    <header className="flex h-14 md:h-16 items-center justify-between border-b border-border bg-white px-4 md:px-5 shrink-0">
      {/* Left: hamburger (mobile) */}
      <button
        onClick={onMenuClick}
        className="md:hidden rounded-md p-2 text-muted-foreground hover:text-foreground min-h-[44px] min-w-[44px] flex items-center justify-center"
        aria-label="Abrir menú"
      >
        <Menu size={20} />
      </button>

      {/* Center: brand name — mobile only */}
      <div className="flex items-center gap-2 md:hidden">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt={orgName} className="h-6 w-auto" />
        ) : (
          <span
            className="flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold text-white"
            style={{ backgroundColor: primaryColor }}
          >
            {orgName.charAt(0)}
          </span>
        )}
        <span className="text-sm font-semibold tracking-tight text-foreground">{orgName}</span>
      </div>

      {/* Desktop spacer */}
      <div className="hidden md:block" />

      {/* Right: user info + sign out */}
      {user && (
        <div className="flex items-center gap-2 md:gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-foreground leading-tight">{user.name}</p>
            <p className="text-xs text-muted-foreground">{USER_ROLE_LABELS[user.role]}</p>
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
            {user.name.charAt(0)}
          </div>
          <button
            onClick={handleSignOut}
            title="Cerrar sesión"
            className="rounded-md p-2 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <LogOut size={16} />
          </button>
        </div>
      )}
    </header>
  );
}
