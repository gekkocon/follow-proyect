import { create } from 'zustand';
import type { ProjectWithRelations } from '@/src/lib/supabase/types';

type SlideOverMode = 'create' | 'edit';

interface ProjectStore {
  isSlideOverOpen: boolean;
  slideOverMode: SlideOverMode;
  selectedProject: ProjectWithRelations | null;
  confirmDeleteId: number | null;
  deleteError: string | null;

  openCreate: () => void;
  openEdit: (project: ProjectWithRelations) => void;
  closeSlideOver: () => void;
  setConfirmDeleteId: (id: number | null) => void;
  setDeleteError: (msg: string | null) => void;
}

export const useProjectStore = create<ProjectStore>((set) => ({
  isSlideOverOpen: false,
  slideOverMode: 'create',
  selectedProject: null,
  confirmDeleteId: null,
  deleteError: null,

  openCreate: () =>
    set({ isSlideOverOpen: true, slideOverMode: 'create', selectedProject: null }),
  openEdit: (project) =>
    set({ isSlideOverOpen: true, slideOverMode: 'edit', selectedProject: project }),
  closeSlideOver: () =>
    set({ isSlideOverOpen: false, selectedProject: null }),
  setConfirmDeleteId: (id) =>
    set({ confirmDeleteId: id, deleteError: null }),
  setDeleteError: (msg) =>
    set({ deleteError: msg }),
}));
