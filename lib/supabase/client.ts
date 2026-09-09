import { supabase } from '@/lib/supabase';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://djkwgwdlygxqcateivbc.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_kC-Ok9GoiYyg3ffh0rpyXg_mS8fY8Gm';

export function createClient() {
  return supabase || createSupabaseClient(supabaseUrl, supabaseAnonKey);
}

export { supabase };
export default createClient;
