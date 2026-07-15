'use client';

import { useState } from 'react';
import { X, SlidersHorizontal, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TASK_STATUS_LABELS, PRIORITY_LABELS } from '@/src/lib/constants';
import type { DbTask, DbUser } from '@/src/lib/supabase/types';

export type TaskFiltersState = {
  status: DbTask['status'] | '';
  priority: DbTask['priority'] | '';
  assigneeId: string;
};

type Props = {
  filters: TaskFiltersState;
  onChange: (f: TaskFiltersState) => void;
  users: Pick<DbUser, 'id' | 'name'>[];
  totalCount: number;
  filteredCount: number;
};

const selectClass =
  'w-full md:w-auto rounded-lg border border-border bg-white px-3 py-2.5 md:py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer min-h-[44px] md:min-h-0';

const STATUS_OPTIONS = Object.entries(TASK_STATUS_LABELS) as [DbTask['status'], string][];
const PRIORITY_OPTIONS = Object.entries(PRIORITY_LABELS) as [DbTask['priority'], string][];

export function TaskFilters({ filters, onChange, users, totalCount, filteredCount }: Props) {
  const [expanded, setExpanded] = useState(false);
  const hasFilters = filters.status !== '' || filters.priority !== '' || filters.assigneeId !== '';

  function set<K extends keyof TaskFiltersState>(key: K, value: TaskFiltersState[K]) {
    onChange({ ...filters, [key]: value });
  }

  function clear() {
    onChange({ status: '', priority: '', assigneeId: '' });
  }

  const activeCount = [filters.status, filters.priority, filters.assigneeId].filter(Boolean).length;

  return (
    <div className="space-y-2">
      {/* Mobile toggle button */}
      <div className="flex items-center justify-between md:hidden">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2.5 text-sm font-medium text-foreground min-h-[44px]"
        >
          <SlidersHorizontal size={14} />
          Filtros
          {activeCount > 0 && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
              {activeCount}
            </span>
          )}
          <ChevronDown
            size={14}
            className={cn('transition-transform', expanded && 'rotate-180')}
          />
        </button>
        <span className="text-xs text-muted-foreground">
          {hasFilters ? `${filteredCount} de ${totalCount}` : totalCount} tarea{totalCount !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Filters panel — always visible on md+, collapsible on mobile */}
      <div className={cn('space-y-2 md:space-y-0 md:flex md:flex-wrap md:items-center md:gap-2', !expanded && 'hidden md:flex')}>
        <select
          value={filters.status}
          onChange={(e) => set('status', e.target.value as TaskFiltersState['status'])}
          className={cn(selectClass, filters.status && 'border-primary/50 ring-1 ring-primary/20')}
        >
          <option value="">Todos los estados</option>
          {STATUS_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>

        <select
          value={filters.priority}
          onChange={(e) => set('priority', e.target.value as TaskFiltersState['priority'])}
          className={cn(selectClass, filters.priority && 'border-primary/50 ring-1 ring-primary/20')}
        >
          <option value="">Todas las prioridades</option>
          {PRIORITY_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>

        <select
          value={filters.assigneeId}
          onChange={(e) => set('assigneeId', e.target.value)}
          className={cn(selectClass, filters.assigneeId && 'border-primary/50 ring-1 ring-primary/20')}
        >
          <option value="">Todos los responsables</option>
          {users.map((u) => <option key={u.id} value={String(u.id)}>{u.name}</option>)}
        </select>

        {hasFilters && (
          <button
            onClick={clear}
            className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2.5 md:py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors min-h-[44px] md:min-h-0 w-full md:w-auto justify-center md:justify-start"
          >
            <X size={12} /> Limpiar filtros
          </button>
        )}

        {/* Count — desktop only (mobile shows above) */}
        <span className="hidden md:inline ml-auto text-xs text-muted-foreground">
          {hasFilters ? `${filteredCount} de ${totalCount}` : totalCount} tarea{totalCount !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  );
}
