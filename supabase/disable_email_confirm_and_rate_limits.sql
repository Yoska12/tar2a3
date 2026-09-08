-- ==============================================================================
-- 🚀 منصة طرقع للكمي - إزالة حد إرسال الإيميلات وتأكيد الحسابات تلقائياً
-- Disable Email Confirm & Remove Rate Limits Script
-- متوافق 100% مع Supabase PostgreSQL 15+
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 💡 الخطوة الأولى والأهم في لوحة تحكم Supabase Dashboard (تأخذ 10 ثوانٍ فقط):
-- ------------------------------------------------------------------------------
-- 1. افتح لوحة تحكم سوبابيز: https://supabase.com/dashboard/project/djkwgwdlygxqcateivbc/auth/providers
-- 2. من القائمة الجانبية: Authentication -> Providers -> Email
-- 3. قم بإلغاء تفعيل خيار "Confirm email" (اجعله مغلقاً / OFF) ثم اضغط Save.
-- بهذه الخطوة البسيطة، لن يحاول Supabase إرسال أي إيميل عند التسجيل، ولن يظهر خطأ Email Rate Limit مجدداً!
-- ------------------------------------------------------------------------------

-- ------------------------------------------------------------------------------
-- الخطوة الثانية: تشغيل هذا السكربت في الـ SQL Editor لتفعيل الحسابات برمجياً
-- ------------------------------------------------------------------------------

-- 1. تفعيل وتأكيد جميع المستخدمين الحاليين في النظام فوراً لمنع حظرهم
UPDATE auth.users 
SET email_confirmed_at = NOW() 
WHERE email_confirmed_at IS NULL;

-- 2. تأكيد وتثبيت حساب السوبر أدمن Yassien Ahmed
UPDATE auth.users
SET 
    email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
    raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role": "super_admin"}'::jsonb,
    raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role": "super_admin", "full_name": "Yassien Ahmed"}'::jsonb
WHERE LOWER(TRIM(email)) = 'yassooooo27m@gmail.com';

UPDATE public.profiles
SET 
    role = 'super_admin',
    full_name = 'Yassien Ahmed'
WHERE LOWER(TRIM(email)) = 'yassooooo27m@gmail.com';

-- 3. إنشاء تريجر تأكيد تلقائي عند إنشاء أي مستخدم جديد (Auto-Confirm Trigger)
-- هذا التريجر يضمن أن أي حساب يسجل مستقبلاً يصبح email_confirmed_at مفعل فوراً على مستوى قاعدة البيانات
CREATE OR REPLACE FUNCTION public.auto_confirm_new_users()
RETURNS trigger AS $$
BEGIN
    -- تعيين تاريخ التأكيد تلقائياً فور إنشاء السجل
    IF NEW.email_confirmed_at IS NULL THEN
        NEW.email_confirmed_at := NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

DROP TRIGGER IF EXISTS trg_auto_confirm_new_users ON auth.users;

CREATE TRIGGER trg_auto_confirm_new_users
BEFORE INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.auto_confirm_new_users();

-- 4. فحص النتيجة للتأكد
SELECT id, email, role, full_name, email_confirmed_at 
FROM public.profiles p
LEFT JOIN auth.users u ON p.id = u.id
ORDER BY (role = 'super_admin') DESC, p.created_at DESC
LIMIT 10;
