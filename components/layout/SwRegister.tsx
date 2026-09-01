'use client';

import { useEffect } from 'react';

export function SwRegister() {
  useEffect(() => {
    // Deuda 32 — the SW is a production-only concern; registering it in
    // dev raced with webpack chunk loading and could break navigation
    // entirely (reproduced in session 1O).
    if (process.env.NODE_ENV !== 'production') return;

    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker
      .getRegistration()
      .then((existing) => {
        if (existing) {
          console.log('SW already registered:', existing.scope);
          return;
        }
        return navigator.serviceWorker
          .register('/sw.js')
          .catch((err) => console.error('SW registration failed:', err));
      })
      .catch((err) => console.error('SW registration failed:', err));
  }, []);

  return null;
}
