'use client';

import { useState, useCallback, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Plus, Pencil, Trash2, AlertTriangle, FolderKanban, CheckSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { updateUserRole, updateUserStatus, deleteUser } from '@/src/lib/supabase/user-actions';
import { UserRoleBadge } from './UserRoleBadge';
import { UserStatusBadge } from './UserStatusBadge';
import { UserRoleSelect } from './UserRoleSelect';
import { UserSlideOver } from './UserSlideOver';
import type { UserWithCounts } from '@/src/lib/supabase/user-actions';
import type { DbUser } from '@/src/lib/supabase/types';

type Props = { initialUsers: UserWithCounts[]; error?: string | null };

export function UsersClient({ initialUsers, error }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [users, setUsers] = useState<UserWithCounts[]>(initialUsers);
  const [slideOver, setSlideOver] = useState<{ open: boolean; mode: 'create' | 'edit'; user?: DbUser }>({ open: false, mode: 'create' });
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const refresh = useCallback(() => startTransition(() => router.refresh()), [router]);

  const handleRoleUpdate = useCallback(async (userId: number, newRole: DbUser['role']) => {
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)));
    const result = await updateUserRole(userId, newRole);
    if (result.error) { setUsers(initialUsers); } else { refresh(); }
  }, [initialUsers, refresh]);

  async function handleStatusToggle(userId: number, current: DbUser['status']) {
    const next: DbUser['status'] = current === 'active' ? 'inactive' : 'active';
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, status: next } : u)));
    const result = await updateUserStatus(userId, next);
    if (result.error) { setUsers(initialUsers); } else { refresh(); }
  }

  async function handleDelete(userId: number) {
    setDeleteLoading(true);
    setDeleteError(null);
    const result = await deleteUser(userId);
    setDeleteLoading(false);
    if (result.error) { setDeleteError(result.error); return; }
    setConfirmDeleteId(null);
    setUsers((prev) => prev.filter((u) => u.id !== userId));
    refresh();
  }

  function handleSlideOverSuccess() {
    setSlideOver({ open: false, mode: 'create' });
    refresh();
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Usuarios</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Equipo y roles de la agencia.</p>
        </div>
        <button
          onClick={() => setSlideOver({ open: true, mode: 'create' })}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors min-h-[44px]"
        >
          <Plus size={16} />
          <span className="hidden sm:inline">Nuevo usuario</span>
          <span className="sm:hidden">Nuevo</span>
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <strong>Error:</strong> {error}
        </div>
      )}

      {users.length === 0 ? (
        <div className="rounded-xl border border-border bg-white p-16 text-center text-sm text-muted-foreground">
          No hay usuarios registrados.
        </div>
      ) : (
        <>
          {/* ── Mobile cards ─────────────────────────────────────────────── */}
          <div className="space-y-3 md:hidden">
            {users.map((user) => {
              const isConfirmDelete = confirmDeleteId === user.id;
              return (
                <div
                  key={user.id}
                  className={cn(
                    'rounded-xl border border-border bg-white p-4 shadow-sm space-y-3',
                    user.status === 'inactive' && 'opacity-60'
                  )}
                >
                  {/* Top row: avatar + info + actions */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                        {user.name.charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="font-medium text-foreground truncate">{user.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                      </div>
                    </div>
                    {!isConfirmDelete && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => setSlideOver({ open: true, mode: 'edit', user })}
                          className="rounded-md p-2.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => { setConfirmDeleteId(user.id); setDeleteError(null); }}
                          className="rounded-md p-2.5 text-muted-foreground hover:bg-red-50 hover:text-red-600 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Role + status row */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <UserRoleBadge role={user.role} />
                    <button onClick={() => handleStatusToggle(user.id, user.status)} className="min-h-[44px] flex items-center">
                      <UserStatusBadge status={user.status} className="hover:opacity-75 transition-opacity" />
                    </button>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground ml-auto">
                      <span className="inline-flex items-center gap-1"><CheckSquare size={11} />{user.task_count}</span>
                      <span className="inline-flex items-center gap-1"><FolderKanban size={11} />{user.project_count}</span>
                    </div>
                  </div>

                  {/* Confirm delete */}
                  {isConfirmDelete && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3 space-y-2">
                      {deleteError ? (
                        <p className="text-xs text-red-700">{deleteError}</p>
                      ) : (
                        <p className="text-xs font-medium text-red-700 flex items-center gap-1.5">
                          <AlertTriangle size={13} /> ¿Eliminar a {user.name}?
                        </p>
                      )}
                      <div className="flex gap-2">
                        <button
                          onClick={() => { setConfirmDeleteId(null); setDeleteError(null); }}
                          className="flex-1 rounded-lg border border-border px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted min-h-[44px]"
                        >
                          Cancelar
                        </button>
                        {!deleteError && (
                          <button
                            onClick={() => handleDelete(user.id)}
                            disabled={deleteLoading}
                            className="flex-1 rounded-lg bg-red-600 px-3 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60 min-h-[44px]"
                          >
                            {deleteLoading ? '...' : 'Sí, eliminar'}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* ── Desktop table ─────────────────────────────────────────────── */}
          <div className="hidden md:block rounded-xl border border-border bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-left text-xs font-medium text-muted-foreground">
                    <th className="px-4 py-3">Usuario</th>
                    <th className="px-4 py-3">Rol</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3 hidden md:table-cell">Asignaciones</th>
                    <th className="px-4 py-3 hidden lg:table-cell">Creado</th>
                    <th className="px-4 py-3 w-20 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {users.map((user) => {
                    const isConfirmDelete = confirmDeleteId === user.id;
                    return (
                      <tr key={user.id} className={cn('group transition-colors hover:bg-muted/30', user.status === 'inactive' && 'opacity-60')}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                              {user.name.charAt(0).toUpperCase()}
                            </span>
                            <div className="min-w-0">
                              <p className="font-medium text-foreground truncate max-w-[180px]">{user.name}</p>
                              <p className="text-xs text-muted-foreground truncate max-w-[180px]">{user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <UserRoleSelect userId={user.id} role={user.role} onUpdate={handleRoleUpdate} />
                        </td>
                        <td className="px-4 py-3">
                          <button onClick={() => handleStatusToggle(user.id, user.status)} className="cursor-pointer">
                            <UserStatusBadge status={user.status} className="hover:opacity-75 transition-opacity" />
                          </button>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-1"><CheckSquare size={12} />{user.task_count}</span>
                            <span className="inline-flex items-center gap-1"><FolderKanban size={12} />{user.project_count}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <span className="text-xs text-muted-foreground">
                            {format(parseISO(user.created_at), 'd MMM yyyy', { locale: es })}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {isConfirmDelete ? (
                            <div className="flex items-center justify-end gap-2">
                              {deleteError ? (
                                <span className="text-xs text-red-600 max-w-[160px] text-right">{deleteError}</span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-xs text-amber-700">
                                  <AlertTriangle size={12} /> ¿Eliminar?
                                </span>
                              )}
                              {!deleteError && (
                                <button onClick={() => handleDelete(user.id)} disabled={deleteLoading}
                                  className="rounded px-2 py-0.5 text-xs font-medium text-white bg-red-500 hover:bg-red-600 disabled:opacity-60">
                                  {deleteLoading ? '...' : 'Sí'}
                                </button>
                              )}
                              <button onClick={() => { setConfirmDeleteId(null); setDeleteError(null); }}
                                className="rounded px-2 py-0.5 text-xs font-medium text-muted-foreground hover:bg-muted">
                                No
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => setSlideOver({ open: true, mode: 'edit', user })}
                                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                                <Pencil size={14} />
                              </button>
                              <button onClick={() => { setConfirmDeleteId(user.id); setDeleteError(null); }}
                                className="rounded-md p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600 transition-colors">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <UserSlideOver
        open={slideOver.open}
        mode={slideOver.mode}
        user={slideOver.user}
        onClose={() => setSlideOver((s) => ({ ...s, open: false }))}
        onSuccess={handleSlideOverSuccess}
      />
    </div>
  );
}
