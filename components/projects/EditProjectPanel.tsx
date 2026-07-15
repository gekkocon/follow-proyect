'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil } from 'lucide-react';
import { ProjectSlideOver } from './ProjectSlideOver';
import type { ProjectWithRelations, DbUser } from '@/src/lib/supabase/types';

type Props = {
  project: ProjectWithRelations;
  users: DbUser[];
};

export function EditProjectPanel({ project, users }: Props) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [, startTransition] = useTransition();

  function handleSuccess() {
    setOpen(false);
    startTransition(() => router.refresh());
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
      >
        <Pencil size={14} />
        Editar
      </button>

      {open && (
        <ProjectSlideOver
          mode="edit"
          project={project}
          users={users}
          onClose={() => setOpen(false)}
          onSuccess={handleSuccess}
        />
      )}
    </>
  );
}
