-- ==============================================================================
-- 🛡️ منصة طرقع للكمي - سكربت معالجة ومزامنة نظام المصادقة والبروفايل المتكامل
-- Complete Supabase Auth & Profiles Synchronization Script
-- متوافق 100% مع معايير Supabase Auth و PostgreSQL 15+ وحزمة @supabase/ssr
-- ==============================================================================

-- تفعيل الامتدادات الضرورية
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. التأكد من وجود نوع الأدوار user_role وتحديثه بكافة الرتب
-- ------------------------------------------------------------------------------
DO $$ BEGIN
    CREATE TYPE public.user_role AS ENUM ('student', 'teacher', 'admin', 'super_admin');
EXCEPTION
    WHEN duplicate_object THEN
        -- إضافة القيم غير الموجودة تدريجياً
        BEGIN
            ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'super_admin';
        EXCEPTION WHEN duplicate_object THEN null; END;
        BEGIN
            ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'admin';
        EXCEPTION WHEN duplicate_object THEN null; END;
        BEGIN
            ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'teacher';
        EXCEPTION WHEN duplicate_object THEN null; END;
        BEGIN
            ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'student';
        EXCEPTION WHEN duplicate_object THEN null; END;
END $$;

-- ------------------------------------------------------------------------------
-- 2. إنشاء / تحديث جدول الملفات الشخصية (public.profiles)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    full_name TEXT,
    avatar_url TEXT DEFAULT '',
    target_score INT DEFAULT 100,
    role public.user_role DEFAULT 'student'::public.user_role,
    telegram_id BIGINT,
    telegram_username TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- فهرس تحسين البحث بالبريد
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- ------------------------------------------------------------------------------
-- 3. تفعيل الحسابات الحالية وتجنب أقفال البريد (Auto-Confirm)
-- ------------------------------------------------------------------------------
-- تفعيل جميع المستخدمين الحاليين في النظام لمنع مشكلة Email Not Confirmed
UPDATE auth.users 
SET email_confirmed_at = NOW() 
WHERE email_confirmed_at IS NULL;

-- تأكيد وتعيين المالك الأساسي Yassien Ahmed كسوبر أدمن المنصة
UPDATE auth.users
SET 
    email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
    raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role": "super_admin"}'::jsonb,
    raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role": "super_admin", "full_name": "Yassien Ahmed"}'::jsonb
WHERE LOWER(TRIM(email)) = 'yassooooo27m@gmail.com';

UPDATE public.profiles
SET 
    role = 'super_admin'::public.user_role,
    full_name = 'Yassien Ahmed'
WHERE LOWER(TRIM(email)) = 'yassooooo27m@gmail.com';

-- ------------------------------------------------------------------------------
-- 4. تريجر تفعيل الحسابات الجديدة تلقائياً (تجاوز حد الإيميلات والـ Lock)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auto_confirm_new_users()
RETURNS trigger AS $$
BEGIN
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

-- ------------------------------------------------------------------------------
-- 5. التريجر الأساسي لإدراج الملف الشخصي تلقائياً (SECURITY DEFINER)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_initial_role public.user_role := 'student';
    v_full_name text;
    v_target_score int := 100;
    v_telegram_username text;
    v_telegram_id bigint;
BEGIN
    -- قراءة البيانات الممررة من الواجهة
    v_full_name := COALESCE(
        NEW.raw_user_meta_data->>'full_name',
        split_part(NEW.email, '@', 1),
        'طالب طرقع'
    );

    BEGIN
        v_target_score := COALESCE((NEW.raw_user_meta_data->>'target_score')::int, 100);
    EXCEPTION WHEN OTHERS THEN
        v_target_score := 100;
    END;

    v_telegram_username := NEW.raw_user_meta_data->>'telegram_username';
    BEGIN
        v_telegram_id := (NEW.raw_user_meta_data->>'telegram_id')::bigint;
    EXCEPTION WHEN OTHERS THEN
        v_telegram_id := NULL;
    END;

    -- تحديد الرتبة: المالك الأساسي يحصل على super_admin دائماً
    IF LOWER(TRIM(NEW.email)) = 'yassooooo27m@gmail.com' THEN
        v_initial_role := 'super_admin';
        v_full_name := 'Yassien Ahmed';
    ELSIF NEW.raw_app_meta_data->>'role' IS NOT NULL THEN
        BEGIN
            IF (NEW.raw_app_meta_data->>'role') = 'super_admin' THEN
                -- منع أي إيميل غير المالك من أخذ رتبة السوبر أدمن
                v_initial_role := 'student';
            ELSE
                v_initial_role := (NEW.raw_app_meta_data->>'role')::public.user_role;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            v_initial_role := 'student';
        END;
    END IF;

    -- إدراج الصف في profiles مع تجاوز أي أخطاء RLS لأن الدالة SECURITY DEFINER
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
        v_full_name,
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
        v_target_score,
        v_initial_role,
        v_telegram_id,
        v_telegram_username,
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
            WHEN LOWER(TRIM(EXCLUDED.email)) = 'yassooooo27m@gmail.com' THEN 'super_admin'::public.user_role 
            ELSE profiles.role 
        END,
        updated_at = NOW();

    -- مزامنة الرتبة في raw_app_meta_data الخاصة بـ JWT لضمان قراءتها فورياً بالـ Middleware
    UPDATE auth.users
    SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', v_initial_role::text)
    WHERE id = NEW.id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- ربط التريجر بجدول auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ------------------------------------------------------------------------------
-- 6. قيد الفهرس الفريد الجزئي لحصر السوبر أدمن في شخص واحد
-- ------------------------------------------------------------------------------
DROP INDEX IF EXISTS public.idx_single_super_admin;
CREATE UNIQUE INDEX idx_single_super_admin 
ON public.profiles (role) 
WHERE role = 'super_admin';

-- ------------------------------------------------------------------------------
-- 7. تريجر الحماية من تعدد السوبر أدمن (Enforce Single Super Admin)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_single_super_admin()
RETURNS TRIGGER AS $$
DECLARE
    v_existing_super_admin_id uuid;
    v_existing_super_admin_email text;
BEGIN
    IF NEW.role = 'super_admin' THEN
        SELECT id, email INTO v_existing_super_admin_id, v_existing_super_admin_email
        FROM public.profiles
        WHERE role = 'super_admin' AND id <> NEW.id
        LIMIT 1;

        IF v_existing_super_admin_id IS NOT NULL THEN
            RAISE EXCEPTION 
                'عملية مرفوضة أمنياً: لا يمكن وجود أكثر من حساب سوبر أدمن (Super Admin) واحد في منصة طرقع. السوبر أدمن الحالي هو (%).'
                , COALESCE(v_existing_super_admin_email, 'الحساب المالك')
                USING ERRCODE = '23505';
        END IF;
    END IF;

    IF TG_OP = 'UPDATE' AND OLD.role = 'super_admin' AND NEW.role <> 'super_admin' THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE role = 'super_admin' AND id <> OLD.id
        ) THEN
            RAISE EXCEPTION 
                'عملية مرفوضة: لا يمكن سحب رتبة السوبر أدمن من هذا الحساب، لأنه السوبر أدمن الوحيد في النظام!'
                USING ERRCODE = '23514';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

DROP TRIGGER IF EXISTS trg_enforce_single_super_admin ON public.profiles;
CREATE TRIGGER trg_enforce_single_super_admin
    BEFORE INSERT OR UPDATE OF role ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_single_super_admin();

-- ------------------------------------------------------------------------------
-- 8. تريجر مزامنة الدور تلقائياً إلى JWT App Metadata في auth.users
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
-- 9. سياسات الأمان RLS المحدثة لجدول profiles
-- ------------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- السماح بقراءة الملفات الشخصية
DROP POLICY IF EXISTS "قراءة الملفات الشخصية للجميع" ON public.profiles;
CREATE POLICY "قراءة الملفات الشخصية للجميع"
    ON public.profiles FOR SELECT
    USING (true);

-- السماح للمستخدم بتعديل ملفه الشخصي فقط (دون تغيير رتبته بنفسه)
DROP POLICY IF EXISTS "تعديل الملف الشخصي للمالك فقط" ON public.profiles;
CREATE POLICY "تعديل الملف الشخصي للمالك فقط"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (
        auth.uid() = id AND 
        (role = (SELECT role FROM public.profiles WHERE id = auth.uid()) OR auth.uid() IN (
            SELECT id FROM public.profiles WHERE role = 'super_admin'
        ))
    );

-- السماح للسوبر أدمن بتعديل وإدارة جميع الملفات الشخصية
DROP POLICY IF EXISTS "إدارة جميع الملفات للسوبر أدمن" ON public.profiles;
CREATE POLICY "إدارة جميع الملفات للسوبر أدمن"
    ON public.profiles FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

-- السماح لتريجرات النظام وعمليات السيرفر بالإدراج بحرية
DROP POLICY IF EXISTS "السماح بإدراج الملفات الشخصية عبر النظام" ON public.profiles;
CREATE POLICY "السماح بإدراج الملفات الشخصية عبر النظام"
    ON public.profiles FOR INSERT
    WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 10. منح الصلاحيات لقواعد البيانات
-- ------------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO postgres, anon, authenticated, service_role;

-- فحص التأكد النهائي
SELECT id, email, role, full_name, email_confirmed_at 
FROM public.profiles p
LEFT JOIN auth.users u ON p.id = u.id
ORDER BY (role = 'super_admin') DESC, p.created_at DESC
LIMIT 5;
