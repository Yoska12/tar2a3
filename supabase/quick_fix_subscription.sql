-- ==============================================================================
-- سكريبت طرقع السريع لإصلاح وتفعيل الاشتراكات في Supabase بنقرة واحدة
-- Tarqa Quick Fix: Subscriptions & Admin Grant RPC
-- ==============================================================================

-- 1. التأكد من وجود أعمدة الاشتراك في جدول profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_subscribed BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ DEFAULT NULL;

-- 2. ترقية حسابات المالك إلى Super Admin فوراً في قاعدة البيانات
UPDATE public.profiles
SET role = 'super_admin', is_subscribed = true, is_banned = false
WHERE LOWER(email) IN ('yassooooo27m@gmail.com', 'iyoskalg@gmail.com');

-- 3. تحديث دالة استخراج الرتبة للتعرف التلقائي على حسابات المالك
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS text AS $$
DECLARE
    v_role text;
    v_email text;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN 'anon';
    END IF;

    v_email := LOWER(COALESCE(auth.jwt() ->> 'email', ''));
    IF v_email IN ('yassooooo27m@gmail.com', 'iyoskalg@gmail.com') THEN
        RETURN 'super_admin';
    END IF;

    SELECT role::text INTO v_role 
    FROM public.profiles 
    WHERE id = auth.uid();

    RETURN COALESCE(v_role, 'student');
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth;

-- 4. دالة التحقق من رتبة المسؤول (Admin / Super Admin)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
    RETURN (auth.uid() IS NOT NULL AND public.get_current_user_role() IN ('admin', 'super_admin'));
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth;

-- 5. دالة تفعيل ومنح الاشتراك للطلاب بواسطة الإدارة حصراً (Security Definer RPC)
CREATE OR REPLACE FUNCTION public.admin_grant_subscription(
    target_user_id text,
    days_count integer DEFAULT 365,
    target_email text DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
    v_expires_at timestamptz;
    v_target_uuid uuid;
    v_rows_updated integer := 0;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'عملية مرفوضة أمنياً: صلاحية تفعيل الاشتراكات محصورة بإدارة المنصة!'
            USING ERRCODE = '42501';
    END IF;

    v_expires_at := now() + (days_count || ' days')::interval;

    -- التحديث بمعرف UUID
    IF target_user_id IS NOT NULL AND target_user_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        v_target_uuid := target_user_id::uuid;
        UPDATE public.profiles
        SET 
            is_subscribed = true,
            subscription_expires_at = v_expires_at,
            updated_at = now()
        WHERE id = v_target_uuid;
        GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
    END IF;

    -- التحديث بالبريد الإلكتروني إن لم يتطابق الـ UUID
    IF v_rows_updated = 0 AND target_email IS NOT NULL AND target_email <> '' THEN
        UPDATE public.profiles
        SET 
            is_subscribed = true,
            subscription_expires_at = v_expires_at,
            updated_at = now()
        WHERE LOWER(email) = LOWER(TRIM(target_email));
        GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'user_id', target_user_id,
        'email', target_email,
        'rows_updated', v_rows_updated,
        'expires_at', v_expires_at
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- نسخة التوافق بمعرف UUID
CREATE OR REPLACE FUNCTION public.admin_grant_subscription(
    target_user_id uuid,
    days_count integer DEFAULT 365
)
RETURNS jsonb AS $$
BEGIN
    RETURN public.admin_grant_subscription(target_user_id::text, days_count, NULL);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- 6. دالة إلغاء الاشتراك بواسطة الإدارة حصراً (Security Definer RPC)
CREATE OR REPLACE FUNCTION public.admin_cancel_subscription(
    target_user_id text,
    target_email text DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
    v_rows_updated integer := 0;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'عملية مرفوضة أمنياً: صلاحية إلغاء الاشتراكات محصورة بإدارة المنصة!'
            USING ERRCODE = '42501';
    END IF;

    IF target_user_id IS NOT NULL AND target_user_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        UPDATE public.profiles
        SET 
            is_subscribed = false,
            subscription_expires_at = NULL,
            updated_at = now()
        WHERE id = target_user_id::uuid;
        GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
    END IF;

    IF v_rows_updated = 0 AND target_email IS NOT NULL AND target_email <> '' THEN
        UPDATE public.profiles
        SET 
            is_subscribed = false,
            subscription_expires_at = NULL,
            updated_at = now()
        WHERE LOWER(email) = LOWER(TRIM(target_email));
        GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'rows_updated', v_rows_updated
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- 7. فتح صلاحيات القراءة والتحديث للأدمن مع إسقاط السياسات السابقة بأمان
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
CREATE POLICY "profiles_select_policy"
    ON public.profiles FOR SELECT
    USING (
        auth.uid() = id 
        OR public.is_admin()
        OR (auth.role() = 'authenticated')
    );

DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;
CREATE POLICY "profiles_update_policy"
    ON public.profiles FOR UPDATE
    USING (
        (auth.uid() = id) 
        OR public.is_admin()
    )
    WITH CHECK (
        (auth.uid() = id) 
        OR public.is_admin()
    );

-- منح صلاحيات التنفيذ لجميع المستخدمين الموثقين (فحص الأمان يتم داخل الدوال)
GRANT EXECUTE ON FUNCTION public.admin_grant_subscription(text, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_grant_subscription(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_cancel_subscription(text, text) TO authenticated;
