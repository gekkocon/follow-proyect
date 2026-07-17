import { create } from 'zustand';
import { brand as staticBrand } from '@/src/lib/config/brand';

export type BrandState = {
  orgName: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string;
};

type BrandStore = BrandState & {
  setBrand: (b: Partial<BrandState>) => void;
};

export const useBrandStore = create<BrandStore>((set) => ({
  orgName:      staticBrand.agency_name,
  logoUrl:      staticBrand.logo_url,
  faviconUrl:   null,
  primaryColor: staticBrand.primary_color,
  setBrand: (b) => set((s) => ({ ...s, ...b })),
}));
