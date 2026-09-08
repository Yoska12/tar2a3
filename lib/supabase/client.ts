import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = 
  process.env.NEXT_PUBLIC_SUPABASE_URL || 
  'https://djkwgwdlygxqcateivbc.supabase.co';

const supabaseAnonKey = 
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 
  'sb_publishable_kC-Ok9GoiYyg3ffh0rpyXg_mS8fY8Gm';

/**
 * عميل Supabase للمتصفح (Browser Client)
 * يُستخدم داخل مكونات العميل ('use client') والواجهات التفاعلية
 * متوافق مع معايير حزمة @supabase/ssr الرسمية
 */
export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}

export default createClient;
