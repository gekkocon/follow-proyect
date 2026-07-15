import { create } from 'zustand';
import type { DbUser } from '@/src/lib/supabase/types';

export type AuthUser = {
  id: number;
  name: string;
  email: string;
  role: DbUser['role'];
};

type AuthStore = {
  user: AuthUser | null;
  setUser: (user: AuthUser | null) => void;
  clearUser: () => void;
};

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  clearUser: () => set({ user: null }),
}));
