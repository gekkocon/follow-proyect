'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { USER_ROLE_LABELS } from '@/src/lib/constants';
import type { DbUser } from '@/src/lib/supabase/types';

type Role = DbUser['role'];

const badgeClass: Record<Role, string> = {
  admin:     'bg-purple-100 text-purple-700',
  pm:        'bg-blue-100 text-blue-700',
  developer: 'bg-cyan-100 text-cyan-700',
  designer:  'bg-pink-100 text-pink-700',
};

const dotClass: Record<Role, string> = {
  admin:     'bg-purple-500',
  pm:        'bg-blue-500',
  developer: 'bg-cyan-500',
  designer:  'bg-pink-500',
};

const ROLE_ORDER: Role[] = ['admin', 'pm', 'developer', 'designer'];
const DROPDOWN_HEIGHT = 152; // approx height of 4 options

type DropdownPos = { top: number; left: number };

type Props = {
  userId: number;
  role: Role;
  onUpdate: (userId: number, newRole: Role) => Promise<void>;
};

export function UserRoleSelect({ userId, role, onUpdate }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<DropdownPos>({ top: 0, left: 0 });
  const [pending, setPending] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onOutside(e: MouseEvent) {
      if (!buttonRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    function onScroll() { setOpen(false); }
    document.addEventListener('mousedown', onOutside);
    document.addEventListener('keydown', onEsc);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onOutside);
      document.removeEventListener('keydown', onEsc);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  function handleOpen() {
    if (pending || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const top = spaceBelow >= DROPDOWN_HEIGHT
      ? rect.bottom + 4
      : rect.top - DROPDOWN_HEIGHT - 4;
    setPos({ top, left: rect.left });
    setOpen((v) => !v);
  }

  async function handleSelect(newRole: Role) {
    setOpen(false);
    if (newRole === role) return;
    setPending(true);
    await onUpdate(userId, newRole);
    setPending(false);
  }

  const dropdown = open && typeof window !== 'undefined'
    ? createPortal(
        <div
          role="listbox"
          style={{ top: pos.top, left: pos.left }}
          className="fixed z-[9999] min-w-[160px] rounded-lg border border-border bg-white shadow-lg py-1 animate-in fade-in-0 zoom-in-95 duration-100"
        >
          {ROLE_ORDER.map((r) => (
            <button
              key={r}
              role="option"
              aria-selected={r === role}
              onMouseDown={(e) => { e.preventDefault(); handleSelect(r); }}
              className={cn(
                'flex w-full items-center gap-2.5 px-3 py-1.5 text-xs transition-colors hover:bg-muted',
                r === role && 'font-semibold bg-muted/60'
              )}
            >
              <span className={cn('h-2 w-2 rounded-full shrink-0', dotClass[r])} />
              {USER_ROLE_LABELS[r]}
            </button>
          ))}
        </div>,
        document.body
      )
    : null;

  return (
    <div className="relative inline-block">
      <button
        ref={buttonRef}
        onClick={handleOpen}
        className={cn(
          'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition-opacity',
          badgeClass[role],
          pending ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:opacity-80'
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {pending && <Loader2 size={10} className="animate-spin shrink-0" />}
        {USER_ROLE_LABELS[role]}
        {!pending && <ChevronDown size={10} className="shrink-0 opacity-60" />}
      </button>

      {dropdown}
    </div>
  );
}
