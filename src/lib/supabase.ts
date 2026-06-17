import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://rmmigmxlfssgzqqnydsj.supabase.co";
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJtbWlnbXhsZnNzZ3pxcW55ZHNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2NTY0OTcsImV4cCI6MjA5NzIzMjQ5N30.VHlXTDGLt7hrtB609VqdSMu12geZphjWbPViXapfNWI";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Clés de stockage
export const KEYS = {
  habitants: 'fokontany_habitants',
  logs: 'fokontany_logs',
  transactions: 'fokontany_transactions',
  materiels: 'fokontany_materiels',
  cotisations: 'fokontany_cotisations',
  presets: 'fokontany_filter_presets',
} as const;

// Lire une valeur
export async function dbGet<T>(key: string): Promise<T | null> {
  const { data, error } = await supabase
    .from('app_store')
    .select('value')
    .eq('key', key)
    .single();
  if (error || !data) return null;
  return data.value as T;
}

// Écrire une valeur
export async function dbSet<T>(key: string, value: T): Promise<void> {
  await supabase
    .from('app_store')
    .upsert({ key, value }, { onConflict: 'key' });
}
