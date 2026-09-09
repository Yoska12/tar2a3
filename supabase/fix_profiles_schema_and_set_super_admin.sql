-- ==============================================================================
-- 👑 منصة طرقع - سكربت إضافة الأعمدة المفقودة وترقية الحساب إلى سوبر أدمن
-- يعمل 100% حتى لو كان جدول profiles لا يحتوي على email أو role
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. إنشاء نوع الرتب المخصص (user_role) إذا لم يكن موجوداً
-- ------------------------------------------------------------------------------
DO $$ BEGIN
    CREATE TYPE public.user_role AS ENUM ('student', 'teacher', 'admin', 'super_admin');
EXCEPTION
    WHEN duplicate_object THEN
        BEGIN
            ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'super_admin';
        EXCEPTION WHEN duplicate_object THEN null; END;
END $$;

-- ------------------------------------------------------------------------------
-- 2. إضافة الأعمدة المفقودة في جدول public.profiles بأمان تام
-- ------------------------------------------------------------------------------
-- إضافة عمود email
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS email TEXT;

-- إضافة عمود role (كنوع user_role أو TEXT كاحتياط)
DO $$ BEGIN
    ALTER TABLE public.profiles 
    ADD COLUMN IF NOT EXISTS role public.user_role NOT NULL DEFAULT 'student'::public.user_role;
EXCEPTION
    WHEN OTHERS THEN
        ALTER TABLE public.profiles 
        ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'student';
END $$;

-- إضافة باقي الأعمدة المفيدة للتأكد من اكتمال البروفايل
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS full_name TEXT DEFAULT 'طالب طرقع';

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS target_score INT DEFAULT 100;

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS telegram_username TEXT;

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS telegram_id BIGINT;

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS avatar_url TEXT DEFAULT '';

-- ------------------------------------------------------------------------------
-- 3. نسخ البريد الإلكتروني (email) من auth.users إلى public.profiles
-- ------------------------------------------------------------------------------
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND (p.email IS NULL OR p.email = '');

-- إنشاء فهرس سريع للبحث بالإيميل
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- ------------------------------------------------------------------------------
-- 4. ترقية حسابك إلى سوبر أدمن (Super Admin) في auth.users
-- (الاعتماد على auth.users.email المضمون وجوده)
-- ------------------------------------------------------------------------------
UPDATE auth.users
SET 
  email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
  raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role": "super_admin", "full_name": "Yoska"}'::jsonb,
  raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role": "super_admin"}'::jsonb
WHERE LOWER(TRIM(email)) = 'yassooooo27m@gmail.com';

-- ------------------------------------------------------------------------------
-- 5. إدراج أو تحديث البروفايل في public.profiles برتبة super_admin واسم Yoska
-- (يعمل حتى لو لم يكن لك صف سابق في جدول profiles)
-- ------------------------------------------------------------------------------
INSERT INTO public.profiles (id, email, full_name, role, target_score)
SELECT 
  u.id, 
  u.email, 
  'Yoska', 
  'super_admin',
  100
FROM auth.users u
WHERE LOWER(TRIM(u.email)) = 'yassooooo27m@gmail.com'
ON CONFLICT (id) DO UPDATE 
SET 
  role = 'super_admin',
  full_name = 'Yoska',
  email = EXCLUDED.email;

-- ------------------------------------------------------------------------------
-- 6. التأكد من إنشاء بروفايل تلقائياً لأي مستخدم جديد يسجل مستقبلاً
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, target_score)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'طالب طرقع'),
    COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role, 'student'::public.user_role),
    COALESCE((NEW.raw_user_meta_data->>'target_score')::int, 100)
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ------------------------------------------------------------------------------
-- 7. الاستعلام النهائي للتحقق من نجاح الترقية (ستظهر نتيجتك في الأسفل)
-- ------------------------------------------------------------------------------
SELECT 
  p.id, 
  u.email, 
  p.full_name, 
  p.role, 
  u.raw_user_meta_data->>'role' as auth_metadata_role
FROM auth.users u
JOIN public.profiles p ON p.id = u.id
WHERE LOWER(TRIM(u.email)) = 'yassooooo27m@gmail.com';
