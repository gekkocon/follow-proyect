'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TASK_STATUS_LABELS } from '@/src/lib/constants';
import type { DbTask } from '@/src/lib/supabase/types';

type Status = DbTask['status'];

const badgeClass: Record<Status, string> = {
  todo:        'bg-slate-100 text-slate-600',
  in_progress: 'bg-blue-100 text-blue-700',
  in_review:   'bg-purple-100 text-purple-700',
  done:        'bg-green-100 text-green-700',
  blocked:     'bg-red-100 text-red-700',
};

const dotClass: Record<Status, string> = {
  todo:        'bg-slate-400',
  in_progress: 'bg-blue-500',
  in_review:   'bg-purple-500',
  done:        'bg-green-500',
  blocked:     'bg-red-500',
};

const STATUS_ORDER: Status[] = ['todo', 'in_progress', 'in_review', 'done', 'blocked'];
const DROPDOWN_HEIGHT = 190; // approx height of 5 options

type DropdownPos = { top: number; left: number };

type Props = {
  taskId: number;
  status: Status;
  onUpdate: (taskId: number, newStatus: Status) => Promise<void>;
};

export function TaskStatusSelect({ taskId, status, onUpdate }: Props) {
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

  async function handleSelect(newStatus: Status) {
    setOpen(false);
    if (newStatus === status) return;
    setPending(true);
    await onUpdate(taskId, newStatus);
    setPending(false);
  }

  const dropdown = open && typeof window !== 'undefined'
    ? createPortal(
        <div
          role="listbox"
          style={{ top: pos.top, left: pos.left }}
          className="fixed z-[9999] min-w-[152px] rounded-lg border border-border bg-white shadow-lg py-1 animate-in fade-in-0 zoom-in-95 duration-100"
        >
          {STATUS_ORDER.map((s) => (
            <button
              key={s}
              role="option"
              aria-selected={s === status}
              onMouseDown={(e) => { e.preventDefault(); handleSelect(s); }}
              className={cn(
                'flex w-full items-center gap-2.5 px-3 py-1.5 text-xs transition-colors hover:bg-muted',
                s === status && 'font-semibold bg-muted/60'
              )}
            >
              <span className={cn('h-2 w-2 rounded-full shrink-0', dotClass[s])} />
              {TASK_STATUS_LABELS[s]}
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
          badgeClass[status],
          pending ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:opacity-80'
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {pending ? (
          <Loader2 size={10} className="animate-spin shrink-0" />
        ) : null}
        {TASK_STATUS_LABELS[status]}
        {!pending && <ChevronDown size={10} className="shrink-0 opacity-60" />}
      </button>

      {dropdown}
    </div>
  );
}
