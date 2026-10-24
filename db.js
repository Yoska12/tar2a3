import { createRequire } from 'module';

// دعم بيئة CommonJS و ES Modules لضمان التوافق التام مع Node.js و Hostinger
const require = typeof globalThis.require === 'function' ? globalThis.require : createRequire(import.meta.url);
const { createClient } = require('@supabase/supabase-js');

// استدعاء متغيرات البيئة التي توفرها Hostinger تلقائياً عند ربط سوبابيز
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://djkwgwdlygxqcateivbc.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_kC-Ok9GoiYyg3ffh0rpyXg_mS8fY8Gm';

// إنشاء عميل Supabase المعتمد للتطبيق
const supabase = createClient(supabaseUrl, supabaseKey);

// دالة فحص الاتصال بقاعدة البيانات مع جدول المستخدمين الرئيسي (profiles)
async function testConnection() {
  try {
    const { data, error } = await supabase.from('profiles').select('*').limit(1);
    if (error) {
      console.error('❌ خطأ في الاتصال بقاعدة بيانات Supabase [profiles]:', error.message || error);
    } else {
      console.log('✅ تم الاتصال بنجاح بقاعدة بيانات Supabase! جدول [profiles] متصل وجاهز.');
    }
  } catch (err) {
    console.error('❌ تعذر تنفيذ استعلام فحص الاتصال:', err);
  }
}

// تنفيذ فحص الاتصال عند تشغيل الملف
testConnection();

export { supabase, testConnection };
export default supabase;
