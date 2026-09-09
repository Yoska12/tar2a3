-- ==============================================================================
-- 👑 منصة طرقع - سكربت حل أخطاء الصلاحيات (Fix 400 & 403 RLS Errors & Super Admin RPCs)
-- قم بنسخ هذا السكربت وتشغيله في Supabase SQL Editor لإنشاء دوال الأمان وسياسات RLS
-- ==============================================================================

-- 1. التأكد من وجود رتبة super_admin في نوع الأدوار
DO $$ BEGIN
    ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'super_admin';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. التأكد من وجود الأعمدة اللازمة في جدول profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name TEXT DEFAULT 'طالب طرقع';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role public.user_role DEFAULT 'student';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ban_reason TEXT DEFAULT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS banned_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 3. التأكد من وجود جدول سجل تغيير الرتب
CREATE TABLE IF NOT EXISTS public.role_change_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID,
    target_user_id UUID NOT NULL,
    old_role public.user_role NOT NULL,
    new_role public.user_role NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==============================================================================
-- 4. دوال الفحص الأمني (Security Helper Functions)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean AS $$
DECLARE
    v_role text;
BEGIN
    -- فحص البريد المباشر للمالك
    IF (auth.jwt() ->> 'email' = 'yassooooo27m@gmail.com') THEN
        RETURN true;
    END IF;

    -- فحص توكن JWT
    v_role := (auth.jwt() -> 'app_metadata' ->> 'role');
    IF v_role = 'super_admin' THEN
        RETURN true;
    END IF;

    -- فحص جدول profiles
    RETURN EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND (role = 'super_admin' OR email = 'yassooooo27m@gmail.com')
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth;

-- ==============================================================================
-- 5. دالة أمنية لتعديل رتبة المستخدمين (Super Admin Update Role)
-- تحل مشكلة 403 وتتجاوز قيود RLS بأمان تام
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.admin_update_user_role(
    target_user_id UUID,
    new_role public.user_role,
    reason TEXT DEFAULT NULL
)
RETURNS boolean AS $$
DECLARE
    v_is_super boolean;
    v_old_role public.user_role;
BEGIN
    -- التحقق من صلاحية المنفذ (السوبر أدمن أو إيميل المالك)
    v_is_super := public.is_super_admin() OR (auth.jwt() ->> 'email' = 'yassooooo27m@gmail.com');
    IF NOT v_is_super THEN
        RAISE EXCEPTION 'غير مصرح: تعديل الرتب محصور بالسوبر أدمن (Super Admin) فقط.';
    END IF;

    -- جلب الرتبة الحالية
    SELECT role INTO v_old_role FROM public.profiles WHERE id = target_user_id;

    -- تحديث الرتبة في جدول profiles
    UPDATE public.profiles
    SET role = new_role, updated_at = now()
    WHERE id = target_user_id;

    -- محاولة تحديث الـ claims في auth.users إن توفرت الصلاحية
    BEGIN
        UPDATE auth.users
        SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', new_role::text)
        WHERE id = target_user_id;
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;

    -- توثيق العملية في سجل التدقيق
    INSERT INTO public.role_change_logs (
        admin_id,
        target_user_id,
        old_role,
        new_role,
        reason,
        created_at
    ) VALUES (
        COALESCE(auth.uid(), target_user_id),
        target_user_id,
        COALESCE(v_old_role, 'student'::public.user_role),
        new_role,
        COALESCE(reason, 'تعديل عبر لوحة تحكم السوبر أدمن'),
        now()
    );

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- ==============================================================================
-- 6. دالة أمنية لحظر وفك حظر الحسابات (Admin Toggle Ban User)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.admin_toggle_ban_user(
    target_user_id UUID,
    p_is_banned BOOLEAN,
    p_reason TEXT DEFAULT NULL
)
RETURNS boolean AS $$
DECLARE
    v_is_super boolean;
    v_target_is_owner boolean;
BEGIN
    v_is_super := public.is_super_admin() OR (auth.jwt() ->> 'email' = 'yassooooo27m@gmail.com');
    IF NOT v_is_super THEN
        RAISE EXCEPTION 'غير مصرح: صلاحية الحظر محصورة برتبة السوبر أدمن (Super Admin) فقط.';
    END IF;

    -- حماية حساب المالك من الحظر
    SELECT (email = 'yassooooo27m@gmail.com' OR role = 'super_admin') INTO v_target_is_owner
    FROM public.profiles
    WHERE id = target_user_id;

    IF v_target_is_owner THEN
        RAISE EXCEPTION 'خطأ أمني: لا يمكن حظر حساب السوبر أدمن الرئيسي للمنصة.';
    END IF;

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

-- ==============================================================================
-- 7. دالة أمنية لحذف الحسابات نهائياً (Admin Delete User)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.admin_delete_user(
    target_user_id UUID
)
RETURNS boolean AS $$
DECLARE
    v_is_super boolean;
    v_target_is_owner boolean;
BEGIN
    v_is_super := public.is_super_admin() OR (auth.jwt() ->> 'email' = 'yassooooo27m@gmail.com');
    IF NOT v_is_super THEN
        RAISE EXCEPTION 'غير مصرح: صلاحية مسح الحسابات محصورة برتبة السوبر أدمن (Super Admin) فقط.';
    END IF;

    SELECT (email = 'yassooooo27m@gmail.com' OR role = 'super_admin') INTO v_target_is_owner
    FROM public.profiles
    WHERE id = target_user_id;

    IF v_target_is_owner THEN
        RAISE EXCEPTION 'خطأ أمني: لا يمكن مسح حساب السوبر أدمن الرئيسي للمنصة.';
    END IF;

    DELETE FROM public.role_change_logs 
    WHERE target_user_id = target_user_id OR admin_id = target_user_id;

    DELETE FROM public.profiles WHERE id = target_user_id;

    BEGIN
        DELETE FROM auth.users WHERE id = target_user_id;
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- منح الصلاحيات لتنفيذ الدوال الأمنية
GRANT EXECUTE ON FUNCTION public.admin_update_user_role(UUID, public.user_role, TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.admin_toggle_ban_user(UUID, BOOLEAN, TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(UUID) TO authenticated, anon;

-- ==============================================================================
-- 8. ضبط وتصحيح سياسات RLS لجدول profiles لمنع أخطاء 403 Forbidden
-- ==============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow select profiles" ON public.profiles;
CREATE POLICY "Allow select profiles"
    ON public.profiles FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Allow update profiles" ON public.profiles;
CREATE POLICY "Allow update profiles"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id OR public.is_super_admin());

DROP POLICY IF EXISTS "Allow insert profiles" ON public.profiles;
CREATE POLICY "Allow insert profiles"
    ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = id OR public.is_super_admin());

-- تعيين حساب Yoska كسوبر أدمن
UPDATE public.profiles
SET role = 'super_admin', full_name = 'Yoska'
WHERE email = 'yassooooo27m@gmail.com';
