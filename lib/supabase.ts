import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
let client: SupabaseClient | null = null;
// Public URL + publishable key only. The service-role key is never used in this app.
export function supa(): SupabaseClient | null {
  if (!URL || !KEY || typeof window === 'undefined') return null;
  return (client ||= createBrowserClient(URL, KEY));
}
