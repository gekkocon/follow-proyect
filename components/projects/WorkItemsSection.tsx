'use client';

import { useState, useEffect } from 'react';
import { Plus, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WorkItemRow } from './WorkItemRow';
import { getProjectWorkItems } from '@/src/lib/supabase/work-item-actions';
import type { WorkItemType, WorkItemWithAssignees, DbUser, DbPhase } from '@/src/lib/supabase/types';

// -----------------------------------------------------------------
// Three stacked accordion blocks, one per work_item type — NOT real
// tabs. No tab component exists anywhere in the repo (confirmed by
// inspection, sesión 1L), and WorkSection in ProjectTasksClient.tsx is
// itself an accordion, not tabs: this reuses that same visual pattern
// (clickable header, chevron, collapsible body) instead of inventing a
// tab widget for this one screen. Kept as its own file/component
// rather than a prop on WorkSection — work_items is a separate table
// from the phase/task hierarchy (CLAUDE.md §7: one table, one actions
// file, one component), so it gets its own sibling component instead
// of extending an already-large one (ProjectTasksClient / TaskRow are
// flagged as the repo's highest-risk files by size — deuda 5).
// -----------------------------------------------------------------

const TABS: { type: WorkItemType; label: string }[] = [
  { type: 'bug', label: 'Bugs' },
  { type: 'debt', label: 'Deuda Técnica' },
  { type: 'question_rfc', label: 'Preguntas/RFC' },
];

const NEW_ITEM_LABEL: Record<WorkItemType, string> = {
  bug: 'Nuevo bug',
  debt: 'Nueva deuda técnica',
  question_rfc: 'Nueva pregunta/RFC',
};

type Props = {
  initialWorkItems: WorkItemWithAssignees[];
  users: Pick<DbUser, 'id' | 'name'>[];
  phases: Pick<DbPhase, 'id' | 'code' | 'name'>[];
  projectId: number;
  canManage: boolean;
};

export function WorkItemsSection({ initialWorkItems, users, phases, projectId, canManage }: Props) {
  const [items, setItems] = useState<WorkItemWithAssignees[]>(initialWorkItems);
  const [openByType, setOpenByType] = useState<Record<WorkItemType, boolean>>({
    bug: false,
    debt: false,
    question_rfc: false,
  });
  const [showNewByType, setShowNewByType] = useState<Record<WorkItemType, boolean>>({
    bug: false,
    debt: false,
    question_rfc: false,
  });

  // Same "seed from Server Component, refetch client-side after every
  // mutation" pattern ProjectTasksClient already uses for the task
  // tree — independent state here, its own refresh(), on purpose.
  useEffect(() => {
    setItems(initialWorkItems);
  }, [initialWorkItems]);

  async function refresh() {
    const fresh = await getProjectWorkItems(projectId);
    setItems(fresh);
  }

  function toggleOpen(type: WorkItemType) {
    setOpenByType((prev) => ({ ...prev, [type]: !prev[type] }));
  }

  return (
    <div className="mt-6">
      <h2 className="mb-3 text-base font-semibold text-foreground">Bloques emergentes</h2>
      <div className="space-y-3">
        {TABS.map(({ type, label }) => {
          const typeItems = items.filter((i) => i.type === type);
          const open = openByType[type];
          const showNew = showNewByType[type];

          return (
            <div key={type} className="rounded-xl border border-border bg-white shadow-sm">
              <div
                onClick={() => toggleOpen(type)}
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/20 transition-colors"
              >
                <ChevronRight
                  size={16}
                  className={cn('shrink-0 text-muted-foreground transition-transform', open && 'rotate-90')}
                />
                <span className="flex-1 min-w-0 truncate text-sm font-semibold text-foreground">{label}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {typeItems.length} ítem{typeItems.length === 1 ? '' : 's'}
                </span>
              </div>

              {open && (
                <div className="border-t border-border bg-muted/10">
                  {typeItems.map((item) => (
                    <WorkItemRow
                      key={item.id}
                      type={type}
                      item={item}
                      projectId={projectId}
                      users={users}
                      phases={phases}
                      canManage={canManage}
                      onRefresh={refresh}
                    />
                  ))}

                  {showNew ? (
                    <WorkItemRow
                      type={type}
                      projectId={projectId}
                      users={users}
                      phases={phases}
                      canManage={canManage}
                      onRefresh={refresh}
                      onSaved={() => {
                        setShowNewByType((prev) => ({ ...prev, [type]: false }));
                        refresh();
                      }}
                      onCancel={() => setShowNewByType((prev) => ({ ...prev, [type]: false }))}
                    />
                  ) : (
                    <div className="border-t border-border p-3">
                      <button
                        onClick={() => setShowNewByType((prev) => ({ ...prev, [type]: true }))}
                        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2 text-sm font-medium text-muted-foreground hover:text-primary hover:bg-muted/30 transition-colors"
                      >
                        <Plus size={14} />
                        {NEW_ITEM_LABEL[type]}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
