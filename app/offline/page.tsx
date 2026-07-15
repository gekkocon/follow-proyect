'use client';

import { WifiOff, RefreshCw } from 'lucide-react';
import { brand } from '@/src/lib/config/brand';

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-muted/30 px-6 text-center">
      <span
        className="flex h-16 w-16 items-center justify-center rounded-2xl text-2xl font-bold text-white"
        style={{ backgroundColor: brand.primary_color }}
      >
        {brand.agency_name.charAt(0)}
      </span>

      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-foreground">{brand.agency_name}</h1>
        <p className="text-sm text-muted-foreground">Dashboard de proyectos</p>
      </div>

      <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-white p-8 shadow-sm max-w-sm w-full">
        <WifiOff size={36} className="text-muted-foreground/50" />
        <p className="text-base font-medium text-foreground">Sin conexión</p>
        <p className="text-sm text-muted-foreground">
          Revisa tu internet e intenta de nuevo.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-2 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <RefreshCw size={14} />
          Reintentar
        </button>
      </div>
    </div>
  );
}
