-- ==============================================================================
-- 🚀 سكريبت طرقع الشامل لإصلاح نظام الاشتراكات والتفعيل/الإلغاء اليدوي في Supabase
-- Tarqa Subscriptions & Admin Activation/Cancellation Fix
-- ==============================================================================

-- 1. التأكد من وجود أعمدة الاشتراك والبريد وتتبع التحميلات في جدول profiles مع تعيين القيمة الافتراضية غير مشترك (FALSE)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_subscribed BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS has_downloaded_files BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS downloaded_files_count INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_downloaded_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS downloaded_files JSONB DEFAULT '[]'::jsonb;

-- مزامنة البريد الإلكتروني من جدول auth.users لجميع المستخدمين المسجلين
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND (p.email IS NULL OR p.email = '');

-- 2. ترقية حسابات المالك إلى Super Admin فوراً وتفعيل اشتراكهم الدائم
UPDATE public.profiles
SET 
    role = 'super_admin', 
    is_subscribed = true, 
    is_banned = false,
    subscription_expires_at = NULL
WHERE LOWER(COALESCE(email, '')) IN ('yassooooo27m@gmail.com', 'iyoskalg@gmail.com');

-- 3. دالة فحص وتحديد الرتبة الحالية للمستخدم
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

-- 4. دالة التحقق من صلاحيات الإدارة (Admin أو Super Admin أو إيميل المالك)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
DECLARE
    v_email text;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN FALSE;
    END IF;
    
    v_email := LOWER(COALESCE(auth.jwt() ->> 'email', ''));
    IF v_email IN ('yassooooo27m@gmail.com', 'iyoskalg@gmail.com') THEN
        RETURN TRUE;
    END IF;

    RETURN (public.get_current_user_role() IN ('admin', 'super_admin'));
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth;

-- 5. تحديث دالة تسجيل المستخدمين الجدد (handle_new_user)
-- تضمن أن أي حساب جديد يكون غير مشترك (is_subscribed = FALSE) إلا إذا كان المالك
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_initial_role public.user_role := 'student';
    v_is_sub boolean := FALSE;
    v_email text;
BEGIN
    v_email := LOWER(COALESCE(NEW.email, ''));

    IF v_email IN ('yassooooo27m@gmail.com', 'iyoskalg@gmail.com') THEN
        v_initial_role := 'super_admin';
        v_is_sub := TRUE;
    ELSIF NEW.raw_app_meta_data->>'role' IS NOT NULL THEN
        BEGIN
            v_initial_role := (NEW.raw_app_meta_data->>'role')::public.user_role;
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
        is_subscribed,
        subscription_expires_at,
        telegram_id,
        telegram_username,
        telegram_chat_id,
        telegram_linked_at,
        created_at,
        updated_at
    )
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', 'طالب طرقع'),
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
        COALESCE((NEW.raw_user_meta_data->>'target_score')::int, 100),
        v_initial_role,
        v_is_sub,
        NULL,
        (NEW.raw_user_meta_data->>'telegram_id')::bigint,
        NEW.raw_user_meta_data->>'telegram_username',
        (NEW.raw_user_meta_data->>'telegram_chat_id')::bigint,
        CASE WHEN (NEW.raw_user_meta_data->>'telegram_id') IS NOT NULL THEN NOW() ELSE NULL END,
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        email = COALESCE(EXCLUDED.email, profiles.email),
        full_name = CASE 
            WHEN profiles.full_name IS NULL OR profiles.full_name = 'طالب طرقع' 
            THEN COALESCE(EXCLUDED.full_name, profiles.full_name) 
            ELSE profiles.full_name 
        END,
        telegram_id = COALESCE(EXCLUDED.telegram_id, profiles.telegram_id),
        telegram_username = COALESCE(EXCLUDED.telegram_username, profiles.telegram_username),
        telegram_chat_id = COALESCE(EXCLUDED.telegram_chat_id, profiles.telegram_chat_id),
        telegram_linked_at = COALESCE(EXCLUDED.telegram_linked_at, profiles.telegram_linked_at),
        updated_at = NOW();
        
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- إعادة ربط التريجر على auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6. دالة تفعيل ومنح الاشتراك للطلاب بواسطة الإدارة حصراً (admin_grant_subscription)
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

    -- التحديث بالـ UUID
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

-- نسخة إضافية للتوافق بمعرف UUID مباشر
CREATE OR REPLACE FUNCTION public.admin_grant_subscription(
    target_user_id uuid,
    days_count integer DEFAULT 365
)
RETURNS jsonb AS $$
BEGIN
    RETURN public.admin_grant_subscription(target_user_id::text, days_count, NULL);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- 7. دالة إلغاء الاشتراك بواسطة الإدارة حصراً (admin_cancel_subscription)
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

    -- إلغاء بالـ UUID
    IF target_user_id IS NOT NULL AND target_user_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        UPDATE public.profiles
        SET 
            is_subscribed = false,
            subscription_expires_at = NULL,
            updated_at = now()
        WHERE id = target_user_id::uuid;
        GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
    END IF;

    -- إلغاء بالبريد الإلكتروني
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
        'user_id', target_user_id,
        'email', target_email,
        'rows_updated', v_rows_updated
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- 8. سياسات الأمان RLS لجدول profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

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

-- 9. إعطاء تصريح التنفيذ للدوال لجميع المستخدمين المسجلين (الفحص الأمني يتم داخل الدالة)
GRANT EXECUTE ON FUNCTION public.admin_grant_subscription(text, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_grant_subscription(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_cancel_subscription(text, text) TO authenticated;

-- 10. دالة تسجيل تحميل ملف للطالب
CREATE OR REPLACE FUNCTION public.track_file_download(
    p_user_id text,
    p_user_email text,
    p_file_title text,
    p_file_url text DEFAULT NULL,
    p_file_type text DEFAULT 'pdf',
    p_file_size text DEFAULT ''
)
RETURNS jsonb AS $$
DECLARE
    v_target_uuid uuid := NULL;
    v_file_entry jsonb;
    v_updated_rows integer := 0;
BEGIN
    v_file_entry := jsonb_build_object(
        'id', 'file_' || floor(extract(epoch from clock_timestamp()) * 1000)::text,
        'title', p_file_title,
        'fileUrl', p_file_url,
        'fileType', p_file_type,
        'fileSize', p_file_size,
        'downloadedAt', now()::text
    );

    IF p_user_id IS NOT NULL AND p_user_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        v_target_uuid := p_user_id::uuid;
    ELSIF auth.uid() IS NOT NULL THEN
        v_target_uuid := auth.uid();
    END IF;

    IF v_target_uuid IS NOT NULL THEN
        UPDATE public.profiles
        SET 
            has_downloaded_files = true,
            downloaded_files_count = COALESCE(downloaded_files_count, 0) + 1,
            last_downloaded_at = now(),
            downloaded_files = COALESCE(downloaded_files, '[]'::jsonb) || jsonb_build_array(v_file_entry),
            updated_at = now()
        WHERE id = v_target_uuid;
        GET DIAGNOSTICS v_updated_rows = ROW_COUNT;
    END IF;

    IF v_updated_rows = 0 AND p_user_email IS NOT NULL AND p_user_email <> '' THEN
        UPDATE public.profiles
        SET 
            has_downloaded_files = true,
            downloaded_files_count = COALESCE(downloaded_files_count, 0) + 1,
            last_downloaded_at = now(),
            downloaded_files = COALESCE(downloaded_files, '[]'::jsonb) || jsonb_build_array(v_file_entry),
            updated_at = now()
        WHERE LOWER(email) = LOWER(TRIM(p_user_email));
        GET DIAGNOSTICS v_updated_rows = ROW_COUNT;
    END IF;

    RETURN jsonb_build_object('success', true, 'updated_rows', v_updated_rows);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

CREATE OR REPLACE FUNCTION public.activate_kashier_subscription(
    p_order_id text DEFAULT NULL,
    p_user_id text DEFAULT NULL,
    p_user_email text DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
    v_target_uuid uuid := NULL;
    v_updated_rows integer := 0;
    v_expires_at timestamptz := now() + interval '365 days';
BEGIN
    IF p_user_id IS NOT NULL AND p_user_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        v_target_uuid := p_user_id::uuid;
    ELSIF auth.uid() IS NOT NULL THEN
        v_target_uuid := auth.uid();
    END IF;

    IF v_target_uuid IS NOT NULL THEN
        UPDATE public.profiles
        SET 
            is_subscribed = true,
            subscription_expires_at = v_expires_at,
            updated_at = now()
        WHERE id = v_target_uuid;
        GET DIAGNOSTICS v_updated_rows = ROW_COUNT;
    END IF;

    IF v_updated_rows = 0 AND p_user_email IS NOT NULL AND p_user_email <> '' THEN
        UPDATE public.profiles
        SET 
            is_subscribed = true,
            subscription_expires_at = v_expires_at,
            updated_at = now()
        WHERE LOWER(email) = LOWER(TRIM(p_user_email));
        GET DIAGNOSTICS v_updated_rows = ROW_COUNT;
    END IF;

    RETURN jsonb_build_object('success', true, 'expires_at', v_expires_at, 'updated_rows', v_updated_rows);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

GRANT EXECUTE ON FUNCTION public.track_file_download(text, text, text, text, text, text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.activate_kashier_subscription(text, text, text) TO authenticated, anon;

