'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

const BottomNav = dynamic(() => import('./BottomNav').then((m) => m.BottomNav), { ssr: false });
import { useBrandStore } from '@/src/store/brandStore';
import type { DbBrandSettings } from '@/src/lib/supabase/brand-actions';

type Props = {
  children: React.ReactNode;
  initialBrand?: DbBrandSettings | null;
};

export function AppLayout({ children, initialBrand }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const setBrand = useBrandStore((s) => s.setBrand);

  useEffect(() => {
    if (!initialBrand) return;
    setBrand({
      orgName:      initialBrand.org_name,
      logoUrl:      initialBrand.logo_url,
      primaryColor: initialBrand.primary_color,
    });
  }, [initialBrand, setBrand]);

  return (
    <div className="flex h-screen overflow-hidden bg-muted/30">
      {/* Sidebar — drawer on mobile, always visible on md+ */}
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        {/* pb-16 reserves space for the fixed bottom nav on mobile */}
        <main className="flex-1 overflow-y-auto px-4 py-5 md:px-6 md:py-6 pb-20 md:pb-6">
          {children}
        </main>
      </div>

      {/* Bottom navigation — mobile only */}
      <BottomNav />
    </div>
  );
}
