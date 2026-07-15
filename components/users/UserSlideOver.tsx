'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';
import { UserForm } from './UserForm';
import type { DbUser } from '@/src/lib/supabase/types';

type Props = {
  open: boolean;
  mode: 'create' | 'edit';
  user?: DbUser;
  onClose: () => void;
  onSuccess: () => void;
};

export function UserSlideOver({ open, mode, user, onClose, onSuccess }: Props) {
  useEffect(() => {
    if (!open) return;
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-base font-semibold text-foreground">
            {mode === 'create' ? 'Nuevo usuario' : 'Editar usuario'}
          </h2>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <UserForm
            user={mode === 'edit' ? user : undefined}
            onSuccess={onSuccess}
            onCancel={onClose}
          />
        </div>
      </div>
    </>
  );
}
