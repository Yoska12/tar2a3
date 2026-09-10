-- ==============================================================================
-- 🚀 منصة طرقع للقدرات - السكربت النهائي الشامل لحل مشكلة ظهور المستخدمين في الداشبورد
-- ==============================================================================
-- المشكلة: قيود الأمان (RLS) في Supabase تمنع قراءة حسابات الطلاب الآخرين افتراضياً
-- هذا السكربت يحل المشكلة جذرياً:
-- 1. إضافة أعمدة الحظر والحالة المفقودة (is_banned, ban_reason, banned_at)
-- 2. فتح سياسة القراءة (SELECT) لجدول profiles لظهور كافة الأعضاء في الداشبورد
-- 3. نسخ كافة المستخدمين المسجلين في auth.users إلى جدول public.profiles فوراً
-- 4. ربط تريجر تلقائي لإدراج أي مستخدم يسجل مستقبلاً مع إيميله وبياناته فوراً
-- 5. تثبيت صلاحيات السوبر أدمن لحساب المالك (yassooooo27m@gmail.com)
-- 6. إنشاء دوال تغيير الرتب والحظر والحذف الإدارية (RPCs)
-- ==============================================================================

-- 1. التأكد من وجود نوع الرتب user_role
DO $$ BEGIN
    CREATE TYPE public.user_role AS ENUM ('student', 'teacher', 'admin', 'super_admin');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'super_admin';

-- 2. إضافة كافة الأعمدة المطلوبة في جدول public.profiles بأمان تام
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name TEXT DEFAULT 'طالب طرقع';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS target_score INT DEFAULT 100;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS telegram_username TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS telegram_id BIGINT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ban_reason TEXT DEFAULT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS banned_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- إضافة عمود role كـ user_role
DO $$ BEGIN
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role public.user_role DEFAULT 'student'::public.user_role;
EXCEPTION WHEN OTHERS THEN
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'student';
END $$;

-- 3. استيراد كافة الحسابات المسجلة حالياً في auth.users إلى جدول profiles (حل مشكلة عدم ظهور المسجلين سابقاً)
INSERT INTO public.profiles (id, email, full_name, role, target_score, created_at, updated_at)
SELECT 
    u.id,
    u.email,
    COALESCE(
        CASE WHEN LOWER(TRIM(u.email)) = 'yassooooo27m@gmail.com' THEN 'Yoska' ELSE NULL END,
        u.raw_user_meta_data->>'full_name',
        split_part(u.email, '@', 1),
        'طالب طرقع'
    ),
    CASE 
        WHEN LOWER(TRIM(u.email)) = 'yassooooo27m@gmail.com' THEN 'super_admin'::public.user_role
        ELSE COALESCE((u.raw_user_meta_data->>'role')::public.user_role, 'student'::public.user_role)
    END,
    COALESCE(
        CASE 
            WHEN (u.raw_user_meta_data->>'target_score') ~ '^[0-9]+$' 
            THEN (u.raw_user_meta_data->>'target_score')::int 
            ELSE 100 
        END, 
        100
    ),
    COALESCE(u.created_at, now()),
    now()
FROM auth.users u
ON CONFLICT (id) DO UPDATE
SET 
    email = COALESCE(EXCLUDED.email, profiles.email),
    full_name = CASE 
        WHEN LOWER(TRIM(EXCLUDED.email)) = 'yassooooo27m@gmail.com' THEN 'Yoska'
        ELSE COALESCE(profiles.full_name, EXCLUDED.full_name)
    END,
    role = CASE 
        WHEN LOWER(TRIM(EXCLUDED.email)) = 'yassooooo27m@gmail.com' THEN 'super_admin'::public.user_role
        ELSE profiles.role
    END,
    updated_at = now();

-- نسخ البريد لجميع الصفوف التي كان فيها الإيميل فارغاً
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND (p.email IS NULL OR p.email = '');

-- إنشاء فهرس سريع للبحث بالبريد
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- 4. تثبيت حساب السوبر أدمن الرئيسي Yoska في auth.users و profiles
UPDATE auth.users
SET 
  email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
  raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role": "super_admin", "full_name": "Yoska"}'::jsonb,
  raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role": "super_admin"}'::jsonb
WHERE LOWER(TRIM(email)) = 'yassooooo27m@gmail.com';

UPDATE public.profiles
SET 
  role = 'super_admin'::public.user_role,
  full_name = 'Yoska',
  is_banned = false
WHERE LOWER(TRIM(email)) = 'yassooooo27m@gmail.com';

-- 5. تحديث دالة وتريجر تسجيل المستخدمين الجدد (handle_new_user) لضمان إدراج كل حساب جديد تلقائياً
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
    COALESCE(
      CASE WHEN LOWER(TRIM(NEW.email)) = 'yassooooo27m@gmail.com' THEN 'Yoska' ELSE NULL END,
      NEW.raw_user_meta_data->>'full_name', 
      split_part(NEW.email, '@', 1),
      'طالب طرقع'
    ),
    CASE 
      WHEN LOWER(TRIM(NEW.email)) = 'yassooooo27m@gmail.com' THEN 'super_admin'::public.user_role
      ELSE COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role, 'student'::public.user_role)
    END,
    COALESCE(
      CASE 
        WHEN (NEW.raw_user_meta_data->>'target_score') ~ '^[0-9]+$' 
        THEN (NEW.raw_user_meta_data->>'target_score')::int 
        ELSE 100 
      END, 
      100
    ),
    NEW.raw_user_meta_data->>'telegram_username',
    CASE 
      WHEN (NEW.raw_user_meta_data->>'telegram_id') ~ '^[0-9]+$' 
      THEN (NEW.raw_user_meta_data->>'telegram_id')::bigint 
      ELSE NULL 
    END,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    telegram_username = COALESCE(EXCLUDED.telegram_username, profiles.telegram_username),
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6. حل مشكلة RLS: السماح بقراءة وتعديل جدول profiles حتى تظهر جميع الحسابات في الداشبورد
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- حذف أي سياسات قديمة مقيدة
DROP POLICY IF EXISTS "Allow select profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow authenticated and admins to read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Allow insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow update profiles" ON public.profiles;

-- أ) سياسة القراءة العامة (SELECT): تتيح للمسؤولين والداشبورد قراءة قائمة المستخدمين كاملة
CREATE POLICY "Allow select profiles"
  ON public.profiles FOR SELECT
  USING (true);

-- ب) سياسة الإدراج (INSERT): تسمح للمستخدم أو النظام بإضافة صف البروفايل
CREATE POLICY "Allow insert profiles"
  ON public.profiles FOR INSERT
  WITH CHECK (true);

-- ج) سياسة التعديل (UPDATE): تسمح بتحديث بيانات البروفايل
CREATE POLICY "Allow update profiles"
  ON public.profiles FOR UPDATE
  USING (true);

-- 7. إنشاء دوال إدارة الرتب والحظر والحذف (RPCs)
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean AS $$
BEGIN
    RETURN (auth.jwt() ->> 'email' = 'yassooooo27m@gmail.com')
        OR ((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin')
        OR EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND (role = 'super_admin' OR email = 'yassooooo27m@gmail.com')
        );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth;

CREATE OR REPLACE FUNCTION public.admin_update_user_role(
    target_user_id UUID,
    new_role public.user_role,
    reason TEXT DEFAULT NULL
)
RETURNS boolean AS $$
BEGIN
    UPDATE public.profiles
    SET role = new_role, updated_at = now()
    WHERE id = target_user_id;

    BEGIN
        UPDATE auth.users
        SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', new_role::text)
        WHERE id = target_user_id;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

CREATE OR REPLACE FUNCTION public.admin_toggle_ban_user(
    target_user_id UUID,
    p_is_banned BOOLEAN,
    p_reason TEXT DEFAULT NULL
)
RETURNS boolean AS $$
BEGIN
    UPDATE public.profiles
    SET 
        is_banned = p_is_banned,
        ban_reason = CASE WHEN p_is_banned THEN p_reason ELSE NULL END,
        banned_at = CASE WHEN p_is_banned THEN now() ELSE NULL END,
        updated_at = now()
    WHERE id = target_user_id;

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

CREATE OR REPLACE FUNCTION public.admin_delete_user(
    target_user_id UUID
)
RETURNS boolean AS $$
BEGIN
    DELETE FROM public.profiles WHERE id = target_user_id;
    BEGIN
        DELETE FROM auth.users WHERE id = target_user_id;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

GRANT EXECUTE ON FUNCTION public.admin_update_user_role(UUID, public.user_role, TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.admin_toggle_ban_user(UUID, BOOLEAN, TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(UUID) TO authenticated, anon;

-- 8. تفعيل البث اللحظي (Realtime) لجدول profiles حتى تصله التحديثات فوراً
DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
EXCEPTION WHEN OTHERS THEN null;
END $$;

-- 9. الاستعلام للتحقق من ظهور جميع المستخدمين
SELECT id, email, full_name, role, target_score, is_banned, created_at
FROM public.profiles
ORDER BY (role = 'super_admin') DESC, created_at DESC;
