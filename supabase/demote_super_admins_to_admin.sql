-- ==============================================================================
-- سكربت إلغاء رتبة السوبر أدمن (Super Admin) وتخفيض كافة الحسابات إلى Admin
-- منصة طرقع للقدرات - التأسيس الكمي
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. إلغاء القيود والتريجرات الخاصة بفرض وجود سوبر أدمن وحيد
-- ------------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_enforce_single_super_admin ON public.profiles;
DROP FUNCTION IF EXISTS public.enforce_single_super_admin();
DROP INDEX IF EXISTS public.idx_single_super_admin;

-- ------------------------------------------------------------------------------
-- 2. تحويل جميع حسابات السوبر أدمن السابقة إلى مسؤول منصة (Admin)
-- ------------------------------------------------------------------------------
-- أ. تحديث جدول profiles
UPDATE public.profiles
SET role = 'admin'::public.user_role,
    updated_at = NOW()
WHERE role = 'super_admin'::public.user_role;

-- ب. ضمان تعيين حساب المالك Yassien Ahmed كمسؤول منصة Admin
UPDATE public.profiles
SET role = 'admin'::public.user_role,
    full_name = 'Yassien Ahmed',
    updated_at = NOW()
WHERE LOWER(TRIM(email)) = 'yassooooo27m@gmail.com';

-- ج. تحديث App Metadata في جدول auth.users لتحديث JWT الفوري
UPDATE auth.users
SET raw_app_meta_data = jsonb_set(
    COALESCE(raw_app_meta_data, '{}'::jsonb),
    '{role}',
    '"admin"'::jsonb
)
WHERE raw_app_meta_data->>'role' = 'super_admin'
   OR LOWER(TRIM(email)) = 'yassooooo27m@gmail.com';

-- ------------------------------------------------------------------------------
-- 3. تريجر مزامنة الدور تلقائياً إلى JWT App Metadata في auth.users
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_profile_role_to_auth()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE auth.users
    SET raw_app_meta_data = jsonb_set(
        COALESCE(raw_app_meta_data, '{}'::jsonb),
        '{role}',
        to_jsonb(NEW.role::text)
    )
    WHERE id = NEW.id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

DROP TRIGGER IF EXISTS trg_sync_profile_role ON public.profiles;
CREATE TRIGGER trg_sync_profile_role
    AFTER INSERT OR UPDATE OF role ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_profile_role_to_auth();

-- ------------------------------------------------------------------------------
-- 4. تحديث دوال التحقق الأمني RLS المعتمدة
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
    -- التحقق من توكن JWT
    IF (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin') THEN
        RETURN true;
    END IF;

    -- التحقق من جدول profiles أو إيميل المالك
    RETURN EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
          AND (role = 'admin' OR role = 'super_admin' OR LOWER(TRIM(email)) = 'yassooooo27m@gmail.com')
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth;

-- إعادة توجيه is_super_admin() إلى is_admin() للتوافق مع أي سياسات سابقة
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean AS $$
BEGIN
    RETURN public.is_admin();
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth;

CREATE OR REPLACE FUNCTION public.is_teacher_or_admin()
RETURNS boolean AS $$
BEGIN
    IF (auth.jwt() -> 'app_metadata' ->> 'role') IN ('teacher', 'admin', 'super_admin') THEN
        RETURN true;
    END IF;

    RETURN EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
          AND (role IN ('teacher', 'admin', 'super_admin') OR LOWER(TRIM(email)) = 'yassooooo27m@gmail.com')
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth;

-- ------------------------------------------------------------------------------
-- 5. تحديث دالة تسجيل المستخدمين الجدد (handle_new_user)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_initial_role public.user_role := 'student';
BEGIN
    -- إعطاء رتبة admin مباشرة لإيميل المالك
    IF LOWER(TRIM(NEW.email)) = 'yassooooo27m@gmail.com' THEN
        v_initial_role := 'admin';
    ELSIF NEW.raw_app_meta_data->>'role' IS NOT NULL THEN
        BEGIN
            -- منع إسناد super_admin وتحويلها إلى admin
            IF (NEW.raw_app_meta_data->>'role') = 'super_admin' THEN
                v_initial_role := 'admin';
            ELSE
                v_initial_role := (NEW.raw_app_meta_data->>'role')::public.user_role;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            v_initial_role := 'student';
        END;
    END IF;

    INSERT INTO public.profiles (
        id, 
        email,
        full_name, 
        avatar_url, 
        target_score,
        role,
        telegram_id,
        telegram_username,
        created_at,
        updated_at
    )
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(
            CASE WHEN LOWER(TRIM(NEW.email)) = 'yassooooo27m@gmail.com' THEN 'Yassien Ahmed' ELSE NULL END,
            NEW.raw_user_meta_data->>'full_name', 
            'طالب طرقع'
        ),
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
        COALESCE((NEW.raw_user_meta_data->>'target_score')::int, 100),
        v_initial_role,
        (NEW.raw_user_meta_data->>'telegram_id')::bigint,
        NEW.raw_user_meta_data->>'telegram_username',
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = CASE 
            WHEN LOWER(TRIM(EXCLUDED.email)) = 'yassooooo27m@gmail.com' THEN 'Yassien Ahmed' 
            ELSE COALESCE(profiles.full_name, EXCLUDED.full_name) 
        END,
        role = CASE 
            WHEN LOWER(TRIM(EXCLUDED.email)) = 'yassooooo27m@gmail.com' THEN 'admin'::public.user_role 
            WHEN profiles.role = 'super_admin' THEN 'admin'::public.user_role
            ELSE profiles.role 
        END,
        updated_at = NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ------------------------------------------------------------------------------
-- 6. سياسات الأمان RLS المحدثة لجدول profiles وجدول سجل التدقيق
-- ------------------------------------------------------------------------------
-- السماح للمسؤولين بتعديل الرتب
DROP POLICY IF EXISTS "تعديل الرتب للسوبر أدمن فقط" ON public.profiles;
DROP POLICY IF EXISTS "تعديل الرتب للمسؤولين" ON public.profiles;

CREATE POLICY "تعديل الرتب للمسؤولين"
    ON public.profiles FOR UPDATE
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- تحديث سياسات سجل التدقيق role_change_logs
CREATE TABLE IF NOT EXISTS public.role_change_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    target_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    old_role public.user_role NOT NULL,
    new_role public.user_role NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.role_change_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "قراءة سجل الرتب للسوبر أدمن فقط" ON public.role_change_logs;
DROP POLICY IF EXISTS "قراءة سجل الرتب للمسؤولين" ON public.role_change_logs;
CREATE POLICY "قراءة سجل الرتب للمسؤولين"
    ON public.role_change_logs FOR SELECT
    USING (public.is_admin());

DROP POLICY IF EXISTS "إدراج سجل الرتب للسوبر أدمن فقط" ON public.role_change_logs;
DROP POLICY IF EXISTS "إدراج سجل الرتب للمسؤولين" ON public.role_change_logs;
CREATE POLICY "إدراج سجل الرتب للمسؤولين"
    ON public.role_change_logs FOR INSERT
    WITH CHECK (public.is_admin());

-- ==============================================================================
-- تم بحمد الله: تم إلغاء رتبة السوبر أدمن، وتخفيض الحسابات إلى Admin بنجاح.
-- ==============================================================================
