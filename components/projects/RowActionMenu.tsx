'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

// Generic portal-based trigger menu, extracted from the "Move to phase"
// menu already in TaskRow.tsx (same positioning-by-getBoundingClientRect,
// same outside-click/Escape/scroll/resize close). TaskRow/SubtaskRow sit
// inside a table with the same overflow-clipping risk documented for
// TaskStatusSelect/UserRoleSelect (deuda 12) — a plain absolute dropdown
// would get cut off the same way, so this needs a portal too, not just
// the move-to-phase menu.
//
// The existing move-to-phase menu in TaskRow is NOT refactored to use
// this component in this session — it already works in production and
// touching it mixes unrelated risk with this task. See CLAUDE.md deuda
// técnica: "patrón de menú-portal duplicado".

const MENU_WIDTH = 220;
const MENU_MAX_HEIGHT = 200;

export type RowActionMenuItem = {
  key: string;
  label: string;
  onSelect: () => void;
};

type Props = {
  items: RowActionMenuItem[];
  title?: string;
  menuLabel?: string;
  triggerClassName?: string;
};

export function RowActionMenu({ items, title = 'Más acciones', menuLabel, triggerClassName }: Props) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  function openMenu() {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const top = spaceBelow >= MENU_MAX_HEIGHT ? rect.bottom + 4 : rect.top - MENU_MAX_HEIGHT - 4;
    setPos({ top, left: Math.max(8, rect.right - MENU_WIDTH) });
    setOpen((v) => !v);
  }

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onDown = (e: MouseEvent) => {
      if (buttonRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const menu =
    open && mounted
      ? createPortal(
          <div
            role="listbox"
            style={{ top: pos.top, left: pos.left, width: MENU_WIDTH }}
            className="fixed z-[9999] max-h-[200px] overflow-y-auto rounded-lg border border-border bg-white shadow-lg py-1 animate-in fade-in-0 zoom-in-95 duration-100"
          >
            {menuLabel && (
              <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {menuLabel}
              </div>
            )}
            {items.map((item) => (
              <button
                key={item.key}
                role="option"
                aria-selected={false}
                onMouseDown={(e) => {
                  e.preventDefault();
                  setOpen(false);
                  item.onSelect();
                }}
                className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-xs transition-colors hover:bg-muted"
              >
                {item.label}
              </button>
            ))}
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <button
        ref={buttonRef}
        onClick={openMenu}
        title={title}
        className={cn(
          'flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-primary hover:bg-muted transition-colors',
          triggerClassName
        )}
      >
        <Plus size={12} />
      </button>
      {menu}
    </>
  );
}
