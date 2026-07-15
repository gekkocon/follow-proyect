'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

type User = { id: number; name: string };

type Props = {
  users: User[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
  placeholder?: string;
  className?: string;
};

export function initials(name: string) {
  return name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function AssigneeAvatars({ users, max = 3 }: { users: User[]; max?: number }) {
  return (
    <div className="flex items-center -space-x-1">
      {users.slice(0, max).map((u) => (
        <span
          key={u.id}
          title={u.name}
          className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary border border-white text-[9px] font-semibold"
        >
          {initials(u.name)}
        </span>
      ))}
      {users.length > max && (
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted border border-white text-[9px] text-muted-foreground font-medium">
          +{users.length - max}
        </span>
      )}
    </div>
  );
}

export function AssigneeSelector({
  users,
  selectedIds,
  onChange,
  placeholder = 'Asignar',
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [dropRect, setDropRect] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      const target = e.target as Node;
      // Check if click is inside the button
      if (buttonRef.current?.contains(target)) return;
      // Check if click is inside the portal dropdown (by data attribute)
      const dropdown = document.querySelector('[data-assignee-dropdown]');
      if (dropdown?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleOpen = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    setDropRect({ top: rect.bottom + 4, left: rect.left });
    setOpen((o) => !o);
  }, []);

  function toggle(id: number) {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((i) => i !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  }

  const selected = users.filter((u) => selectedIds.includes(u.id));

  const dropdown =
    open && mounted && dropRect
      ? createPortal(
          <div
            data-assignee-dropdown
            style={{
              position: 'fixed',
              top: dropRect.top,
              left: dropRect.left,
              zIndex: 9999,
            }}
            className="w-52 rounded-lg border border-border bg-white shadow-xl"
          >
            <div className="max-h-52 overflow-y-auto p-1">
              {users.length === 0 ? (
                <p className="px-2 py-2 text-xs text-muted-foreground">
                  Sin usuarios disponibles
                </p>
              ) : (
                users.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault(); // prevent focus loss / outside-click race
                      toggle(u.id);
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted transition-colors text-left"
                  >
                    <span
                      className={cn(
                        'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
                        selectedIds.includes(u.id)
                          ? 'bg-primary border-primary text-white'
                          : 'border-border bg-white'
                      )}
                    >
                      {selectedIds.includes(u.id) && <Check size={10} strokeWidth={3} />}
                    </span>
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-[9px] font-semibold">
                      {initials(u.name)}
                    </span>
                    <span className="truncate text-xs text-foreground">{u.name}</span>
                  </button>
                ))
              )}
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <div className={cn('relative inline-flex', className)}>
        <button
          ref={buttonRef}
          type="button"
          onClick={handleOpen}
          className="flex items-center gap-1.5 rounded-md border border-border bg-white px-2 py-1 text-sm hover:bg-muted transition-colors min-w-[80px] max-w-[140px]"
        >
          {selected.length === 0 ? (
            <>
              <Users size={11} className="text-muted-foreground shrink-0" />
              <span className="text-muted-foreground text-xs truncate">{placeholder}</span>
            </>
          ) : (
            <AssigneeAvatars users={selected} />
          )}
          <ChevronDown size={11} className="text-muted-foreground ml-auto shrink-0" />
        </button>
      </div>
      {dropdown}
    </>
  );
}
