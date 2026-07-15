'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/src/store/authStore';
import type { AuthUser } from '@/src/store/authStore';

type Props = { user: AuthUser | null };

/** Hydrates the Zustand auth store with the server-resolved session user. */
export function AuthHydrator({ user }: Props) {
  const setUser = useAuthStore((s) => s.setUser);

  useEffect(() => {
    setUser(user);
  }, [user, setUser]);

  return null;
}
