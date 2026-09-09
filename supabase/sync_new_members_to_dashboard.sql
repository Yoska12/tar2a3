-- ==============================================================================
-- 🚀 منصة طرقع - سكربت مزامنة الأعضاء الجدد فوراً مع لوحة الإدارة
-- يضمن ظهور أي مستخدم يسجل جديداً في الداشبورد تلقائياً وبشكل فوري
-- ==============================================================================

-- 1. التأكد من وجود عمود email وبقية الأعمدة في جدول public.profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name TEXT DEFAULT 'طالب طرقع';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS target_score INT DEFAULT 100;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS telegram_username TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS telegram_id BIGINT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 2. نسخ كافة الإيميلات الحالية من auth.users لجدول profiles
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND (p.email IS NULL OR p.email = '');

-- 3. إنشاء فهرس على عمود الإيميل للبحث السريع
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- 4. تحديث دالة وتريجر التسجيل التلقائي (on_auth_user_created)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (
    id, 
    email, 
    full_name, 
    role, 
    target_score, 
    telegram_username, 
    telegram_id,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'طالب طرقع'),
    COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role, 'student'::public.user_role),
    COALESCE((NEW.raw_user_meta_data->>'target_score')::int, 100),
    NEW.raw_user_meta_data->>'telegram_username',
    (NEW.raw_user_meta_data->>'telegram_id')::bigint,
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    telegram_username = COALESCE(EXCLUDED.telegram_username, profiles.telegram_username),
    updated_at = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- إعادة ربط التريجر بجدول auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. تفعيل سياسة قراءة آمنة لجدول profiles لظهور جميع الأعضاء للمسؤولين
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated and admins to read profiles" ON public.profiles;
CREATE POLICY "Allow authenticated and admins to read profiles"
  ON public.profiles FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Allow users and admins to update profile" ON public.profiles;
CREATE POLICY "Allow users and admins to update profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id OR public.is_admin() OR public.is_super_admin());

-- 6. تفعيل البث اللحظي (Realtime) لجدول profiles حتى تصله التحديثات فوراً
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
EXCEPTION
  WHEN duplicate_object THEN null;
  WHEN OTHERS THEN null;
END $$;
