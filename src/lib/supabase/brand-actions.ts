'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from './server';

export type DbBrandSettings = {
  id: number;
  org_name: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  font_family: string;
  created_at: string;
  updated_at: string;
};

export type BrandFormValues = {
  org_name: string;
  logo_url: string;
  primary_color: string;
};

export async function fetchBrandSettings(): Promise<{
  brand: DbBrandSettings | null;
  error: string | null;
}> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('brand_settings')
    .select('*')
    .limit(1)
    .maybeSingle();

  if (error) return { brand: null, error: error.message };
  return { brand: data, error: null };
}

export async function saveBrandSettings(
  values: BrandFormValues,
  existingId?: number
): Promise<{ error: string | null }> {
  const supabase = createServerClient();

  const payload = {
    org_name:      values.org_name.trim(),
    logo_url:      values.logo_url.trim() || null,
    primary_color: values.primary_color,
  };

  let error;

  if (existingId) {
    ({ error } = await supabase
      .from('brand_settings')
      .update(payload)
      .eq('id', existingId));
  } else {
    ({ error } = await supabase
      .from('brand_settings')
      .insert(payload));
  }

  if (error) return { error: error.message };

  revalidatePath('/settings');
  revalidatePath('/', 'layout');
  return { error: null };
}
