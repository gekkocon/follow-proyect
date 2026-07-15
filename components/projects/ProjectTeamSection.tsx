'use client';

import { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Trash2, Check, X, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { initials } from './AssigneeSelector';
import { MemberSelector } from './MemberSelector';
import {
  addProjectMember,
  updateMemberRole,
  removeProjectMember,
} from '@/src/lib/supabase/member-actions';
import type { DbUser, ProjectMemberWithUser } from '@/src/lib/supabase/types';

const ROLE_LABELS: Record<DbUser['role'], string> = {
  admin: 'Admin',
  pm: 'Coordinador',
  developer: 'Desarrollador',
  designer: 'Diseñador',
};

// ─────────────────────────────────────────────
// Single member row
// ─────────────────────────────────────────────

type MemberRowProps = {
  member: ProjectMemberWithUser;
  projectId: number;
  canManage: boolean;
  onRefresh: () => void;
};

function MemberRow({ member, projectId, canManage, onRefresh }: MemberRowProps) {
  const [editing, setEditing] = useState(false);
  const [roleValue, setRoleValue] = useState(member.rol_en_proyecto ?? '');
  const [saving, setSaving] = useState(false);
  const [, startTransition] = useTransition();
  const router = useRouter();

  async function saveRole() {
    setSaving(true);
    const { error } = await updateMemberRole(
      member.id,
      projectId,
      roleValue.trim() || null
    );
    setSaving(false);
    if (!error) {
      setEditing(false);
      onRefresh();
      startTransition(() => router.refresh());
    }
  }

  async function handleRemove() {
    if (!confirm(`¿Quitar a ${member.user.name} del proyecto?`)) return;
    const { error } = await removeProjectMember(member.id, projectId);
    if (!error) {
      onRefresh();
      startTransition(() => router.refresh());
    }
  }

  return (
    <div className="group flex items-center gap-3 py-2.5 px-1 hover:bg-muted/20 rounded-lg transition-colors">
      {/* Avatar */}
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
        {initials(member.user.name)}
      </span>

      {/* Name + email + system role */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{member.user.name}</p>
        <p className="text-[11px] text-muted-foreground truncate">{member.user.email}</p>
      </div>

      {/* System role badge */}
      <span className="hidden sm:inline-flex shrink-0 text-[10px] font-medium rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
        {ROLE_LABELS[member.user.role]}
      </span>

      {/* Rol en proyecto — inline edit */}
      {editing ? (
        <div className="flex items-center gap-1">
          <input
            autoFocus
            value={roleValue}
            onChange={(e) => setRoleValue(e.target.value)}
            placeholder="Rol en proyecto"
            className="rounded-md border border-border px-2 py-1 text-xs w-32 focus:outline-none focus:ring-1 focus:ring-primary bg-white"
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveRole();
              if (e.key === 'Escape') setEditing(false);
            }}
          />
          <button
            onClick={saveRole}
            disabled={saving}
            className="flex h-6 w-6 items-center justify-center rounded text-green-600 hover:bg-green-100 disabled:opacity-40"
          >
            <Check size={11} />
          </button>
          <button
            onClick={() => { setEditing(false); setRoleValue(member.rol_en_proyecto ?? ''); }}
            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted"
          >
            <X size={11} />
          </button>
        </div>
      ) : (
        <span
          className={cn(
            'text-xs shrink-0 max-w-[100px] truncate',
            member.rol_en_proyecto ? 'text-foreground' : 'text-muted-foreground italic'
          )}
        >
          {member.rol_en_proyecto ?? 'Sin rol'}
        </span>
      )}

      {/* Actions — only for managers */}
      {canManage && !editing && (
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => setEditing(true)}
            title="Editar rol en proyecto"
            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-primary hover:bg-muted transition-colors"
          >
            <Pencil size={11} />
          </button>
          <button
            onClick={handleRemove}
            title="Quitar del proyecto"
            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors"
          >
            <Trash2 size={11} />
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// ProjectTeamSection
// ─────────────────────────────────────────────

type Props = {
  projectId: number;
  initialMembers: ProjectMemberWithUser[];
  allUsers: Pick<DbUser, 'id' | 'name' | 'email' | 'role'>[];
  canManage: boolean;
};

export function ProjectTeamSection({
  projectId,
  initialMembers,
  allUsers,
  canManage,
}: Props) {
  const [members, setMembers] = useState<ProjectMemberWithUser[]>(initialMembers);
  const [, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => { setMembers(initialMembers); }, [initialMembers]);

  function refresh() {
    startTransition(() => router.refresh());
  }

  async function handleAdd(userId: number, rolEnProyecto?: string) {
    const { error } = await addProjectMember(projectId, userId, rolEnProyecto);
    if (!error) refresh();
  }

  return (
    <div className="rounded-xl border border-border bg-white p-5 shadow-sm mb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users size={15} className="text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">
            Equipo del proyecto{' '}
            <span className="font-normal text-muted-foreground">({members.length})</span>
          </h2>
        </div>
        {canManage && (
          <MemberSelector
            allUsers={allUsers}
            currentMembers={members}
            onAdd={handleAdd}
          />
        )}
      </div>

      {/* Member list */}
      {members.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          Este proyecto aún no tiene miembros asignados.
          {canManage && ' Usa "Agregar miembro" para comenzar.'}
        </p>
      ) : (
        <div className="divide-y divide-border/50">
          {members.map((m) => (
            <MemberRow
              key={m.id}
              member={m}
              projectId={projectId}
              canManage={canManage}
              onRefresh={refresh}
            />
          ))}
        </div>
      )}
    </div>
  );
}
