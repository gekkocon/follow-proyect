'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';
import { ProjectForm } from './ProjectForm';
import type { ProjectWithRelations, DbUser } from '@/src/lib/supabase/types';

type Props = {
  mode: 'create' | 'edit';
  project: ProjectWithRelations | null;
  users: DbUser[];
  onClose: () => void;
  onSuccess: () => void;
};

export function ProjectSlideOver({ mode, project, users, onClose, onSuccess }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const title = mode === 'create' ? 'Nuevo proyecto' : 'Editar proyecto';

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4 shrink-0">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <ProjectForm
            mode={mode}
            project={project}
            users={users}
            onSuccess={onSuccess}
            onCancel={onClose}
          />
        </div>
      </div>
    </>
  );
}
