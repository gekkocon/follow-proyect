'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Search, UserPlus, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { initials } from './AssigneeSelector';
import type { DbUser, ProjectMemberWithUser } from '@/src/lib/supabase/types';

type Props = {
  /** All active users in the system */
  allUsers: Pick<DbUser, 'id' | 'name' | 'email' | 'role'>[];
  /** Users already in the project — excluded from selector */
  currentMembers: ProjectMemberWithUser[];
  onAdd: (userId: number, rolEnProyecto?: string) => Promise<void>;
};

const ROLE_LABELS: Record<DbUser['role'], string> = {
  admin: 'Admin',
  pm: 'Coordinador',
  developer: 'Desarrollador',
  designer: 'Diseñador',
};

export function MemberSelector({ allUsers, currentMembers, onAdd }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [roleInputs, setRoleInputs] = useState<Record<number, string>>({});
  const [adding, setAdding] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [dropRect, setDropRect] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => { setMounted(true); }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target)) return;
      if (document.querySelector('[data-member-selector]')?.contains(target)) return;
      setOpen(false);
      setSearch('');
      setSelectedIds([]);
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

  const currentIds = new Set(currentMembers.map((m) => m.user_id));

  const filtered = allUsers
    .filter((u) => !currentIds.has(u.id))
    .filter((u) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    });

  function toggleUser(id: number) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  }

  async function handleAdd() {
    if (!selectedIds.length) return;
    setAdding(true);
    for (const uid of selectedIds) {
      await onAdd(uid, roleInputs[uid] || undefined);
    }
    setAdding(false);
    setOpen(false);
    setSearch('');
    setSelectedIds([]);
    setRoleInputs({});
  }

  const dropdown =
    open && mounted && dropRect
      ? createPortal(
          <div
            data-member-selector
            style={{
              position: 'fixed',
              top: dropRect.top,
              left: dropRect.left,
              zIndex: 9999,
              width: 320,
            }}
            className="rounded-xl border border-border bg-white shadow-xl"
          >
            {/* Search */}
            <div className="flex items-center gap-2 border-b border-border px-3 py-2">
              <Search size={13} className="text-muted-foreground shrink-0" />
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre o email…"
                className="flex-1 text-sm focus:outline-none bg-transparent"
              />
            </div>

            {/* User list */}
            <div className="max-h-56 overflow-y-auto p-1">
              {filtered.length === 0 ? (
                <p className="px-3 py-3 text-xs text-muted-foreground text-center">
                  {allUsers.length === currentMembers.length
                    ? 'Todos los usuarios ya son miembros'
                    : 'Sin resultados'}
                </p>
              ) : (
                filtered.map((u) => {
                  const checked = selectedIds.includes(u.id);
                  return (
                    <div key={u.id}>
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          toggleUser(u.id);
                        }}
                        className={cn(
                          'flex w-full items-center gap-2.5 rounded-lg px-2 py-2 transition-colors text-left',
                          checked ? 'bg-primary/5' : 'hover:bg-muted'
                        )}
                      >
                        <span
                          className={cn(
                            'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
                            checked ? 'bg-primary border-primary text-white' : 'border-border'
                          )}
                        >
                          {checked && <Check size={10} strokeWidth={3} />}
                        </span>
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-semibold">
                          {initials(u.name)}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-xs font-medium text-foreground truncate">{u.name}</span>
                          <span className="block text-[10px] text-muted-foreground truncate">{u.email}</span>
                        </span>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {ROLE_LABELS[u.role]}
                        </span>
                      </button>

                      {/* Role-in-project input when selected */}
                      {checked && (
                        <div className="flex items-center gap-2 px-2 pb-1.5">
                          <span className="w-4 shrink-0" />
                          <span className="w-7 shrink-0" />
                          <input
                            value={roleInputs[u.id] ?? ''}
                            onChange={(e) =>
                              setRoleInputs((r) => ({ ...r, [u.id]: e.target.value }))
                            }
                            placeholder="Rol en proyecto (opcional)"
                            className="flex-1 rounded-md border border-border px-2 py-0.5 text-[10px] focus:outline-none focus:ring-1 focus:ring-primary bg-white"
                            onMouseDown={(e) => e.stopPropagation()}
                          />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            {selectedIds.length > 0 && (
              <div className="border-t border-border p-2 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {selectedIds.length} seleccionado{selectedIds.length > 1 ? 's' : ''}
                </span>
                <button
                  onClick={handleAdd}
                  disabled={adding}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  <UserPlus size={11} />
                  {adding ? 'Agregando…' : 'Agregar al proyecto'}
                </button>
              </div>
            )}
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleOpen}
        className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-1.5 text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors"
      >
        <UserPlus size={14} />
        Agregar miembro
      </button>
      {dropdown}
    </>
  );
}
