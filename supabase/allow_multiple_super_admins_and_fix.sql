-- ==============================================================================
-- 👑 منصة طرقع للقدرات - سكربت تفعيل وإتاحة رتبة السوبر أدمن المتعدد
-- Allow Multiple Super Admins & Fix Role Assignment in Supabase
-- ==============================================================================

-- 1. إزالة أي قيود أو تريجرات سابقة تمنع وجود أكثر من حساب سوبر أدمن
DROP TRIGGER IF EXISTS trg_enforce_single_super_admin ON public.profiles;
DROP FUNCTION IF EXISTS public.enforce_single_super_admin();
DROP INDEX IF EXISTS public.idx_single_super_admin;

-- 2. التأكد من وجود رتبة 'super_admin' في نوع الأدوار user_role
DO $$ BEGIN
    CREATE TYPE public.user_role AS ENUM ('student', 'teacher', 'admin', 'super_admin');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'super_admin';

-- 3. التأكد من وجود عمود role في profiles
DO $$ BEGIN
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role public.user_role DEFAULT 'student'::public.user_role;
EXCEPTION WHEN OTHERS THEN
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'student';
END $$;

-- 4. إتاحة تحديث الرتب للمسؤولين والسوبر أدمن في RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow select profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Profiles update policy" ON public.profiles;
DROP POLICY IF EXISTS "Allow users and admins to update profile" ON public.profiles;

CREATE POLICY "Allow select profiles"
    ON public.profiles FOR SELECT
    USING (true);

CREATE POLICY "Allow update profiles"
    ON public.profiles FOR UPDATE
    USING (true)
    WITH CHECK (true);

-- 5. إنشاء دالة admin_update_user_role المعتمدة مع مزامنة JWT App Metadata
CREATE OR REPLACE FUNCTION public.admin_update_user_role(
    target_user_id UUID,
    new_role public.user_role,
    reason TEXT DEFAULT NULL
)
RETURNS boolean AS $$
BEGIN
    -- تحديث الرتبة في profiles
    UPDATE public.profiles
    SET role = new_role, updated_at = now()
    WHERE id = target_user_id;

    -- مزامنة التغيير في جدول auth.users (JWT Claims)
    BEGIN
        UPDATE auth.users
        SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', new_role::text),
            raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('role', new_role::text)
        WHERE id = target_user_id;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    -- تسجيل العملية في سجل التدقيق إن وجد الجدول
    BEGIN
        INSERT INTO public.role_change_logs (admin_id, target_user_id, new_role, reason, created_at)
        VALUES (auth.uid(), target_user_id, new_role, COALESCE(reason, 'تعديل الصلاحية عبر لوحة الإدارة'), now());
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- منح الصلاحيات للمستخدمين المسجلين
GRANT EXECUTE ON FUNCTION public.admin_update_user_role(UUID, public.user_role, TEXT) TO authenticated, anon;

-- دالة مرنة لتحديث الرتبة بواسطة أي معرف (UUID أو بريد أو يوزر تليجرام)
CREATE OR REPLACE FUNCTION public.admin_update_user_role_by_identifier(
    p_identifier TEXT,
    new_role public.user_role,
    reason TEXT DEFAULT NULL
)
RETURNS boolean AS $$
DECLARE
    v_target_id UUID;
    v_clean_ident TEXT;
BEGIN
    v_clean_ident := LOWER(TRIM(p_identifier));

    -- محاولة فك الـ UUID
    BEGIN
        v_target_id := p_identifier::UUID;
    EXCEPTION WHEN OTHERS THEN
        v_target_id := NULL;
    END;

    IF v_target_id IS NOT NULL THEN
        UPDATE public.profiles SET role = new_role, updated_at = now() WHERE id = v_target_id;
    ELSE
        UPDATE public.profiles 
        SET role = new_role, updated_at = now() 
        WHERE LOWER(TRIM(email)) = v_clean_ident
           OR LOWER(TRIM(telegram_username)) = v_clean_ident
           OR LOWER(TRIM(telegram_username)) = '@' || v_clean_ident
           OR LOWER(TRIM(REPLACE(telegram_username, '@', ''))) = v_clean_ident;
        
        SELECT id INTO v_target_id FROM public.profiles 
        WHERE LOWER(TRIM(email)) = v_clean_ident
           OR LOWER(TRIM(telegram_username)) = v_clean_ident
           OR LOWER(TRIM(telegram_username)) = '@' || v_clean_ident
           OR LOWER(TRIM(REPLACE(telegram_username, '@', ''))) = v_clean_ident
        LIMIT 1;
    END IF;

    IF v_target_id IS NOT NULL THEN
        BEGIN
            UPDATE auth.users
            SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', new_role::text),
                raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('role', new_role::text)
            WHERE id = v_target_id;
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
    END IF;

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

GRANT EXECUTE ON FUNCTION public.admin_update_user_role_by_identifier(TEXT, public.user_role, TEXT) TO authenticated, anon;

-- 6. تريجر تلقائي لمزامنة أي تغيير بالرتبة إلى auth.users تلقائياً
CREATE OR REPLACE FUNCTION public.sync_profile_role_to_auth()
RETURNS TRIGGER AS $$
BEGIN
    BEGIN
        UPDATE auth.users
        SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', NEW.role::text)
        WHERE id = NEW.id;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

DROP TRIGGER IF EXISTS trg_sync_profile_role ON public.profiles;
CREATE TRIGGER trg_sync_profile_role
    AFTER INSERT OR UPDATE OF role ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_profile_role_to_auth();

-- 7. تثبيت حساب المالك Yoska كسوبر أدمن
UPDATE auth.users
SET 
  raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role": "super_admin", "full_name": "Yoska"}'::jsonb,
  raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role": "super_admin"}'::jsonb
WHERE LOWER(TRIM(email)) = 'yassooooo27m@gmail.com';

UPDATE public.profiles
SET 
  role = 'super_admin'::public.user_role,
  full_name = 'Yoska'
WHERE LOWER(TRIM(email)) = 'yassooooo27m@gmail.com';
