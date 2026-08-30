import { create } from 'zustand';

// Ephemeral UI state only — lost on refresh and that's fine. Bridges the
// "create from a task/subtask" trigger in TaskRow/SubtaskRow with the
// work item creation form in WorkItemsSection/WorkItemRow, which live in
// a separate part of the tree (siblings, not parent/child — sesión 1L,
// decisión H).
export type PendingWorkItemOrigin = {
  workItemType: 'bug' | 'debt' | 'question_rfc';
  // UI-only restriction: work_item_origins supports 'phase' at the data
  // level, but this store never offers it — origins are only created
  // from a task or subtask row.
  originType: 'task' | 'subtask';
  originId: number;
  /** Already-composed human-readable code, e.g. "F3-T08". */
  originLabel: string;
};

type WorkItemOriginStore = {
  pending: PendingWorkItemOrigin | null;
  setPending: (p: PendingWorkItemOrigin) => void;
  clearPending: () => void;
};

export const useWorkItemOriginStore = create<WorkItemOriginStore>((set) => ({
  pending: null,
  setPending: (p) => set({ pending: p }),
  clearPending: () => set({ pending: null }),
}));
