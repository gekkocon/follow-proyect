'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useBrandStore } from '@/src/store/brandStore';

const MODULE_LABELS: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/projects':  'Proyectos',
  '/tasks':     'Tareas',
  '/users':     'Usuarios',
  '/settings':  'Configuración',
};

function moduleLabelFor(pathname: string): string | null {
  // Exact match first (e.g. /dashboard), then prefix match (e.g. /projects/12)
  if (MODULE_LABELS[pathname]) return MODULE_LABELS[pathname];
  const base = '/' + pathname.split('/')[1];
  return MODULE_LABELS[base] ?? null;
}

/** Keeps the browser tab title and favicon in sync with brand settings + active module. */
export function BrandMeta() {
  const pathname    = usePathname();
  const orgName     = useBrandStore((s) => s.orgName);
  const faviconUrl  = useBrandStore((s) => s.faviconUrl);

  // Tab title: "<Módulo> · <Agencia>"
  useEffect(() => {
    const moduleLabel = moduleLabelFor(pathname);
    document.title = moduleLabel ? `${moduleLabel} · ${orgName}` : orgName;
  }, [pathname, orgName]);

  // Favicon: swap the <link rel="icon"> href
  useEffect(() => {
    const href = faviconUrl || '/icons/icon-192.svg';
    let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = href;
  }, [faviconUrl]);

  return null;
}
