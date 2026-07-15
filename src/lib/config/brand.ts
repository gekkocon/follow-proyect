// TODO: Move to Supabase `brand_settings` table in a future phase.
// Reading from DB will allow per-agency customization without redeploy.
export const brand = {
  agency_name: 'FEMCO',
  logo_url: null as string | null, // replace with real URL when available
  primary_color: '#2563EB',        // used as CSS custom property --brand-primary
  primary_hsl: '217 91% 60%',      // HSL version injected into globals.css --primary
} as const;

export type Brand = typeof brand;
