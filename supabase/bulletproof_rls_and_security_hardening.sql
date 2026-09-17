-- ==============================================================================
-- 🛡️ منصة طرقع للقدرات - السكربت الأمني الشامل والنهائي (Bulletproof Database Security)
-- الحماية الكاملة ضد هجمات Burp Suite واعتراض طلبات PostgREST وتعديل الصلاحيات
-- متوافق 100% مع Supabase PostgreSQL 15+ و Row Level Security (RLS) و Custom Claims
-- ==============================================================================

-- تفعيل الامتدادات الضرورية
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- المرحلة 1: حرمان دور الزوار (anon) من أي صلاحيات تعديل أو حذف أو إدخال (Schema Hardening)
-- ==============================================================================

-- 1. تجريد دور anon تماماً من صلاحيات CUD على كافة جداول النظام
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA public FROM public;

-- 2. حصر دور anon في القراءة SELECT فقط (وتكون مقيدة بسياسات RLS اللاحقة)
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- 3. تطبيق القواعد الافتراضية للجداول المستقبلية (Alter Default Privileges)
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;

-- ==============================================================================
-- المرحلة 2: التأكد من وجود الأنواع والأعمدة والجداول المطلوبة
-- ==============================================================================

DO $$ BEGIN
    CREATE TYPE public.user_role AS ENUM ('student', 'teacher', 'admin', 'super_admin');
EXCEPTION
    WHEN duplicate_object THEN
        BEGIN ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'super_admin'; EXCEPTION WHEN duplicate_object THEN null; END;
        BEGIN ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'admin'; EXCEPTION WHEN duplicate_object THEN null; END;
        BEGIN ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'teacher'; EXCEPTION WHEN duplicate_object THEN null; END;
        BEGIN ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'student'; EXCEPTION WHEN duplicate_object THEN null; END;
END $$;

-- التأكد من أعمدة الأمان في جدول profiles
DO $$ BEGIN
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role public.user_role DEFAULT 'student'::public.user_role;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_subscribed BOOLEAN DEFAULT FALSE;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT FALSE;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ban_reason TEXT;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- قيود التحقق الصارم من مدخلات البروفايل (Database Check Constraints لمنع إدخال بيانات ضارة أو غير صالحة)
DO $$ BEGIN
    ALTER TABLE public.profiles 
        DROP CONSTRAINT IF EXISTS chk_profile_target_score,
        ADD CONSTRAINT chk_profile_target_score CHECK (target_score >= 50 AND target_score <= 100);
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE public.profiles 
        DROP CONSTRAINT IF EXISTS chk_profile_full_name_length,
        ADD CONSTRAINT chk_profile_full_name_length CHECK (char_length(full_name) >= 2 AND char_length(full_name) <= 100);
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE public.profiles 
        DROP CONSTRAINT IF EXISTS chk_profile_email_valid,
        ADD CONSTRAINT chk_profile_email_valid CHECK (email IS NULL OR email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- التأكد من وجود جدول سجل التدقيق الأمني role_change_logs
CREATE TABLE IF NOT EXISTS public.role_change_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    target_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    old_role TEXT,
    new_role TEXT NOT NULL,
    reason TEXT DEFAULT 'تعديل الصلاحية عبر النظام الأمني',
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ==============================================================================
-- المرحلة 3: دوال الأمان المساعدة المحصنة ضد الاختراق (Security Definer Functions)
-- تم قفل المسار search_path = public, auth لمنع هجمات Search Path Injection
-- ==============================================================================

-- 1. فحص هل المستخدم مسجل دخول حالياً
CREATE OR REPLACE FUNCTION public.is_authenticated()
RETURNS boolean AS $$
BEGIN
    RETURN (auth.role() = 'authenticated' AND auth.uid() IS NOT NULL);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth;

-- 2. جلب دور المستخدم الحقيقي الموثق من قاعدة البيانات مباشرة
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS text AS $$
DECLARE
    v_role text;
    v_email text;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN 'anon';
    END IF;

    -- التحقق الفوري من إيميل المالك لضمان عدم حجب صلاحيات السوبر أدمن
    v_email := LOWER(COALESCE(auth.jwt() ->> 'email', ''));
    IF v_email IN ('yassooooo27m@gmail.com', 'iyoskalg@gmail.com') THEN
        RETURN 'super_admin';
    END IF;

    -- قراءة الرتبة مباشرة من جدول profiles المحمي
    SELECT role::text INTO v_role 
    FROM public.profiles 
    WHERE id = auth.uid();

    RETURN COALESCE(v_role, 'student');
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth;

-- 3. فحص هل المستخدم مسؤول (Admin أو Super Admin)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
    RETURN (public.is_authenticated() AND public.get_current_user_role() IN ('admin', 'super_admin'));
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth;

-- 4. فحص هل المستخدم سوبر أدمن حصراً (Super Admin)
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean AS $$
BEGIN
    RETURN (public.is_authenticated() AND public.get_current_user_role() = 'super_admin');
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth;

-- 5. فحص صلاحيات المعلم أو الإدارة (Teacher or Admin)
CREATE OR REPLACE FUNCTION public.is_teacher_or_admin()
RETURNS boolean AS $$
BEGIN
    RETURN (public.is_authenticated() AND public.get_current_user_role() IN ('teacher', 'admin', 'super_admin'));
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth;

-- 6. دالة تفعيل ومنح الاشتراك للطلاب بواسطة الإدارة حصراً (Security Definer RPC)
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

    -- محاولة التحديث بالـ UUID أولاً إن كان المعرف صالحاً
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

    -- إذا لم يتم تحديث أي صف، نحاول التحديث عبر البريد الإلكتروني إن وجد
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

-- نسخة التوافق بمعرف UUID مباشر
CREATE OR REPLACE FUNCTION public.admin_grant_subscription(
    target_user_id uuid,
    days_count integer DEFAULT 365
)
RETURNS jsonb AS $$
BEGIN
    RETURN public.admin_grant_subscription(target_user_id::text, days_count, NULL);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- 7. دالة إلغاء الاشتراك بواسطة الإدارة حصراً (Security Definer RPC)
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

-- ==============================================================================
-- المرحلة 4: تريجرز وقيود منع التلاعب وتصعيد الصلاحيات (Anti-Tampering Guards)
-- ==============================================================================

-- 1. تريجر حماية الحقول الحساسة في البروفايل (منع تصعيد الرتب وتزييف الاشتراكات عند الإدراج والتحديث)
CREATE OR REPLACE FUNCTION public.protect_profile_sensitive_fields()
RETURNS TRIGGER AS $$
BEGIN
    -- إذا كان المستدعي مستخدم عادي مصرح له (وليس خدمة سيرفر service_role أو أدمن)
    IF auth.role() = 'authenticated' AND NOT public.is_admin() THEN
        IF TG_OP = 'INSERT' THEN
            -- حظر إنشاء الحساب بأي رتبة غير student (منع التلاعب عبر POST /rest/v1/profiles)
            IF NEW.role IS NOT NULL AND NEW.role <> 'student'::public.user_role THEN
                RAISE EXCEPTION 'عملية مرفوضة أمنياً: لا يمكنك منح نفسك رتبة إدارية عند التسجيل!'
                    USING ERRCODE = '42501';
            END IF;

            -- حظر تفعيل الاشتراك أو وضع تاريخ انتهاء بنفسه
            IF NEW.is_subscribed = true OR NEW.subscription_expires_at IS NOT NULL THEN
                NEW.is_subscribed := false;
                NEW.subscription_expires_at := NULL;
            END IF;

            -- حظر وضع علامة الحظر
            IF NEW.is_banned = true THEN
                NEW.is_banned := false;
            END IF;
        ELSIF TG_OP = 'UPDATE' THEN
            -- 1. منع تعديل الرتبة نهائياً
            IF NEW.role IS DISTINCT FROM OLD.role THEN
                RAISE EXCEPTION 'عملية غير مصرح بها: محاولة تصعيد صلاحيات غير قانونية! لا يمكن تعديل الرتبة إلا بواسطة مسؤول المنصة.'
                    USING ERRCODE = '42501';
            END IF;

            -- 2. منع تعديل حالة الاشتراك أو تاريخ الانتهاء
            IF NEW.is_subscribed IS DISTINCT FROM OLD.is_subscribed OR
               NEW.subscription_expires_at IS DISTINCT FROM OLD.subscription_expires_at THEN
                RAISE EXCEPTION 'عملية مرفوضة أمنياً: لا يمكنك تعديل حالة الاشتراك مباشرة!'
                    USING ERRCODE = '42501';
            END IF;

            -- 3. منع فك الحظر عن النفس
            IF NEW.is_banned IS DISTINCT FROM OLD.is_banned THEN
                RAISE EXCEPTION 'عملية مرفوضة أمنياً: لا يمكنك تعديل حالة الحظر!'
                    USING ERRCODE = '42501';
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

DROP TRIGGER IF EXISTS trg_protect_profile_sensitive_fields ON public.profiles;
CREATE TRIGGER trg_protect_profile_sensitive_fields
    BEFORE INSERT OR UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_profile_sensitive_fields();

-- 2. تريجر حماية auth.users قبل الإدراج (BEFORE INSERT) لتطهير الـ Metadata وتثبيت الرتبة في التوكن بالذاكرة
CREATE OR REPLACE FUNCTION public.harden_auth_user_signup()
RETURNS trigger AS $$
DECLARE
    v_role text := 'student';
    v_is_owner boolean;
BEGIN
    v_is_owner := (LOWER(TRIM(NEW.email)) = 'yassooooo27m@gmail.com');
    
    IF v_is_owner THEN
        v_role := 'super_admin';
    ELSE
        v_role := 'student';
    END IF;

    -- حظر التلاعب: تجريد أي دور أو اشتراك يمرره المهاجم عبر user_metadata بواسطة Burp Suite
    NEW.raw_user_meta_data := (COALESCE(NEW.raw_user_meta_data, '{}'::jsonb) - 'role' - 'is_admin' - 'is_super_admin' - 'is_subscribed');

    -- تثبيت الرتبة الآمنة مباشرة داخل Custom Claims في الذاكرة (raw_app_meta_data) قبل كتابة السجل
    NEW.raw_app_meta_data := jsonb_set(
        COALESCE(NEW.raw_app_meta_data, '{}'::jsonb),
        '{role}',
        to_jsonb(v_role)
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

DROP TRIGGER IF EXISTS trg_harden_auth_user_signup ON auth.users;
CREATE TRIGGER trg_harden_auth_user_signup
    BEFORE INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.harden_auth_user_signup();

-- 3. دالة إدراج ملف المستخدم بأمان في جدول profiles عند اكتمال التسجيل عبر /auth/v1/signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
    v_role public.user_role := 'student';
    v_full_name text;
    v_target_score int;
    v_is_owner boolean;
BEGIN
    v_is_owner := (LOWER(TRIM(NEW.email)) = 'yassooooo27m@gmail.com');
    
    -- حماية مطلقة: الرتبة دائماً 'student' لأي حساب جديد يسجل عبر /auth/v1/signup
    IF v_is_owner THEN
        v_role := 'super_admin'::public.user_role;
        v_full_name := 'Yassien Ahmed';
    ELSE
        v_role := 'student'::public.user_role;
        v_full_name := COALESCE(
            NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
            NULLIF(TRIM(split_part(NEW.email, '@', 1)), ''),
            'طالب طرقع'
        );
    END IF;

    -- التحقق من هدف القدرات وتأمينه (بين 50 و 100)
    BEGIN
        v_target_score := COALESCE(NULLIF((NEW.raw_user_meta_data->>'target_score')::int, 0), 100);
        IF v_target_score < 50 OR v_target_score > 100 THEN
            v_target_score := 100;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        v_target_score := 100;
    END;

    -- إدراج حساب الطالب بأمان تام في جدول profiles
    INSERT INTO public.profiles (
        id, 
        email, 
        full_name, 
        role, 
        target_score, 
        telegram_username, 
        telegram_id,
        is_subscribed,
        is_banned,
        created_at,
        updated_at
    )
    VALUES (
        NEW.id,
        NEW.email,
        v_full_name,
        v_role,
        v_target_score,
        NULLIF(TRIM(NEW.raw_user_meta_data->>'telegram_username'), ''),
        CASE 
            WHEN (NEW.raw_user_meta_data->>'telegram_id') ~ '^[0-9]+$' 
            THEN (NEW.raw_user_meta_data->>'telegram_id')::bigint 
            ELSE NULL 
        END,
        v_is_owner, -- الاشتراك مفعل فقط للمالك
        false,      -- غير محظور
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE
    SET 
        email = EXCLUDED.email,
        full_name = CASE 
            WHEN v_is_owner THEN 'Yassien Ahmed' 
            ELSE COALESCE(profiles.full_name, EXCLUDED.full_name) 
        END,
        telegram_username = COALESCE(profiles.telegram_username, EXCLUDED.telegram_username),
        role = CASE 
            WHEN v_is_owner THEN 'super_admin'::public.user_role 
            ELSE profiles.role 
        END,
        updated_at = NOW();

    -- ضمان مزامنة الرتبة في raw_app_meta_data لحمايتها من أي استثناء
    BEGIN
        UPDATE auth.users
        SET raw_app_meta_data = jsonb_set(
            COALESCE(raw_app_meta_data, '{}'::jsonb),
            '{role}',
            to_jsonb(v_role::text)
        )
        WHERE id = NEW.id;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- 4. مزامنة الرتبة تلقائياً إلى توكن الـ JWT حصراً عند تعديلها مستقبلاً من قبل المسؤولين
CREATE OR REPLACE FUNCTION public.sync_profile_role_to_jwt()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
        UPDATE auth.users
        SET raw_app_meta_data = jsonb_set(
            COALESCE(raw_app_meta_data, '{}'::jsonb),
            '{role}',
            to_jsonb(NEW.role::text)
        )
        WHERE id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

DROP TRIGGER IF EXISTS trg_sync_profile_role_to_jwt ON public.profiles;
CREATE TRIGGER trg_sync_profile_role_to_jwt
    AFTER UPDATE OF role ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_profile_role_to_jwt();

-- 3. قيود فحص صحة بيانات الاختبارات (Database Check Constraints)
DO $$ BEGIN
    ALTER TABLE public.user_quiz_attempts 
        DROP CONSTRAINT IF EXISTS chk_score_range,
        ADD CONSTRAINT chk_score_range CHECK (score >= 0.00 AND score <= 100.00);
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE public.user_quiz_attempts 
        DROP CONSTRAINT IF EXISTS chk_counts_valid,
        ADD CONSTRAINT chk_counts_valid CHECK (correct_count >= 0 AND wrong_count >= 0 AND total_questions >= 0);
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ==============================================================================
-- المرحلة 5: إعادة هيكلة وتأمين دوال الـ RPC الإدارية
-- ==============================================================================

-- إلغاء النسخ السابقة المتساهلة
DROP FUNCTION IF EXISTS public.admin_update_user_role(UUID, public.user_role, TEXT);
DROP FUNCTION IF EXISTS public.admin_update_user_role_by_identifier(TEXT, public.user_role, TEXT);

-- إنشاء دالة تغيير الرتب المحصنة 100%
CREATE OR REPLACE FUNCTION public.admin_update_user_role(
    target_user_id UUID,
    new_role public.user_role,
    reason TEXT DEFAULT NULL
)
RETURNS boolean AS $$
DECLARE
    v_old_role text;
BEGIN
    -- 1. فحص صارم: المستدعي يجب أن يكون Admin أو Super Admin
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'رفض أمني: هذه العملية مخصصة لمدراء المنصة فقط.'
            USING ERRCODE = '42501';
    END IF;

    -- 2. فحص صلاحية منح رتبة السوبر أدمن (مقصورة على السوبر أدمن الحالي فقط)
    IF new_role = 'super_admin' AND NOT public.is_super_admin() THEN
        RAISE EXCEPTION 'رفض أمني: ترقية مستخدم إلى سوبر أدمن محصورة بالسوبر أدمن فقط.'
            USING ERRCODE = '42501';
    END IF;

    -- 3. جلب الرتبة السابقة للتدقيق
    SELECT role::text INTO v_old_role FROM public.profiles WHERE id = target_user_id;

    -- 4. منع تخفيض رتبة سوبر أدمن بواسطة أدمن عادي
    IF v_old_role = 'super_admin' AND NOT public.is_super_admin() THEN
        RAISE EXCEPTION 'رفض أمني: لا يمكن للأدمن العادي تعديل رتبة السوبر أدمن!'
            USING ERRCODE = '42501';
    END IF;

    -- 5. التحديث في جدول profiles
    UPDATE public.profiles
    SET role = new_role, updated_at = NOW()
    WHERE id = target_user_id;

    -- 6. تسجيل العملية في سجل التدقيق الأمني
    INSERT INTO public.role_change_logs (admin_id, target_user_id, old_role, new_role, reason, created_at)
    VALUES (auth.uid(), target_user_id, v_old_role, new_role::text, COALESCE(reason, 'تعديل عبر دالة الإدارة الآمنة'), NOW());

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- سحب الصلاحيات من العامة و anon ومنحها لـ authenticated فقط (مع فحص داخلي صارم)
REVOKE EXECUTE ON FUNCTION public.admin_update_user_role(UUID, public.user_role, TEXT) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_update_user_role(UUID, public.user_role, TEXT) TO authenticated;

-- ==============================================================================
-- المرحلة 6: تفعيل الـ RLS الإجباري على كافة الجداول (Enforce RLS Everywhere)
-- ==============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;

ALTER TABLE public.user_quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_quiz_attempts FORCE ROW LEVEL SECURITY;

ALTER TABLE public.saved_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_questions FORCE ROW LEVEL SECURITY;

ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions FORCE ROW LEVEL SECURITY;

ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quizzes FORCE ROW LEVEL SECURITY;

ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_questions FORCE ROW LEVEL SECURITY;

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories FORCE ROW LEVEL SECURITY;

ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topics FORCE ROW LEVEL SECURITY;

ALTER TABLE public.role_change_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_change_logs FORCE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'modules') THEN
        ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.modules FORCE ROW LEVEL SECURITY;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'lessons') THEN
        ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.lessons FORCE ROW LEVEL SECURITY;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'lesson_attachments') THEN
        ALTER TABLE public.lesson_attachments ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.lesson_attachments FORCE ROW LEVEL SECURITY;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_lesson_progress') THEN
        ALTER TABLE public.user_lesson_progress ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.user_lesson_progress FORCE ROW LEVEL SECURITY;
    END IF;
END $$;

-- ==============================================================================
-- المرحلة 7: تطهير كافة السياسات السابقة المتساهلة (Drop Loose Policies)
-- ==============================================================================

-- تنظيف profiles
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_policy" ON public.profiles;
DROP POLICY IF EXISTS "Allow select profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow users and admins to update profile" ON public.profiles;
DROP POLICY IF EXISTS "Profiles view policy" ON public.profiles;
DROP POLICY IF EXISTS "Profiles update policy" ON public.profiles;
DROP POLICY IF EXISTS "Profiles delete policy" ON public.profiles;
DROP POLICY IF EXISTS "قراءة الملفات الشخصية للجميع" ON public.profiles;
DROP POLICY IF EXISTS "تعديل الملف الشخصي للمالك فقط" ON public.profiles;
DROP POLICY IF EXISTS "إدارة جميع الملفات للسوبر أدمن" ON public.profiles;
DROP POLICY IF EXISTS "السماح بإدراج الملفات الشخصية عبر النظام" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- تنظيف user_quiz_attempts
DROP POLICY IF EXISTS "attempts_select_policy" ON public.user_quiz_attempts;
DROP POLICY IF EXISTS "attempts_insert_policy" ON public.user_quiz_attempts;
DROP POLICY IF EXISTS "attempts_update_policy" ON public.user_quiz_attempts;
DROP POLICY IF EXISTS "attempts_delete_policy" ON public.user_quiz_attempts;
DROP POLICY IF EXISTS "Attempts select policy" ON public.user_quiz_attempts;
DROP POLICY IF EXISTS "Attempts insert policy" ON public.user_quiz_attempts;
DROP POLICY IF EXISTS "Attempts update policy" ON public.user_quiz_attempts;
DROP POLICY IF EXISTS "Attempts delete policy" ON public.user_quiz_attempts;
DROP POLICY IF EXISTS "Users can view own attempts" ON public.user_quiz_attempts;
DROP POLICY IF EXISTS "Users can insert own attempts" ON public.user_quiz_attempts;

-- تنظيف saved_questions
DROP POLICY IF EXISTS "saved_questions_select_policy" ON public.saved_questions;
DROP POLICY IF EXISTS "saved_questions_insert_policy" ON public.saved_questions;
DROP POLICY IF EXISTS "saved_questions_update_policy" ON public.saved_questions;
DROP POLICY IF EXISTS "saved_questions_delete_policy" ON public.saved_questions;
DROP POLICY IF EXISTS "Saved questions policy" ON public.saved_questions;

-- تنظيف questions
DROP POLICY IF EXISTS "questions_select_policy" ON public.questions;
DROP POLICY IF EXISTS "questions_insert_policy" ON public.questions;
DROP POLICY IF EXISTS "questions_update_policy" ON public.questions;
DROP POLICY IF EXISTS "questions_delete_policy" ON public.questions;
DROP POLICY IF EXISTS "Questions select policy" ON public.questions;
DROP POLICY IF EXISTS "Questions insert policy" ON public.questions;
DROP POLICY IF EXISTS "Questions update policy" ON public.questions;
DROP POLICY IF EXISTS "Questions delete policy" ON public.questions;

-- تنظيف quizzes
DROP POLICY IF EXISTS "quizzes_select_policy" ON public.quizzes;
DROP POLICY IF EXISTS "quizzes_insert_policy" ON public.quizzes;
DROP POLICY IF EXISTS "quizzes_update_policy" ON public.quizzes;
DROP POLICY IF EXISTS "quizzes_delete_policy" ON public.quizzes;
DROP POLICY IF EXISTS "Quizzes select policy" ON public.quizzes;
DROP POLICY IF EXISTS "Quizzes write policy" ON public.quizzes;

-- تنظيف quiz_questions
DROP POLICY IF EXISTS "quiz_questions_select_policy" ON public.quiz_questions;
DROP POLICY IF EXISTS "quiz_questions_write_policy" ON public.quiz_questions;
DROP POLICY IF EXISTS "Quiz questions select policy" ON public.quiz_questions;
DROP POLICY IF EXISTS "Quiz questions write policy" ON public.quiz_questions;

-- تنظيف categories
DROP POLICY IF EXISTS "categories_select_policy" ON public.categories;
DROP POLICY IF EXISTS "categories_insert_policy" ON public.categories;
DROP POLICY IF EXISTS "categories_update_policy" ON public.categories;
DROP POLICY IF EXISTS "categories_delete_policy" ON public.categories;
DROP POLICY IF EXISTS "Categories view policy" ON public.categories;
DROP POLICY IF EXISTS "Categories insert policy" ON public.categories;
DROP POLICY IF EXISTS "Categories update policy" ON public.categories;
DROP POLICY IF EXISTS "Categories delete policy" ON public.categories;

-- تنظيف topics
DROP POLICY IF EXISTS "topics_select_policy" ON public.topics;
DROP POLICY IF EXISTS "topics_write_policy" ON public.topics;
DROP POLICY IF EXISTS "Topics view policy" ON public.topics;
DROP POLICY IF EXISTS "Topics write policy" ON public.topics;

-- تنظيف role_change_logs
DROP POLICY IF EXISTS "role_logs_select_policy" ON public.role_change_logs;
DROP POLICY IF EXISTS "role_logs_insert_policy" ON public.role_change_logs;
DROP POLICY IF EXISTS "Admins can view role logs" ON public.role_change_logs;
DROP POLICY IF EXISTS "System can insert role logs" ON public.role_change_logs;

-- ==============================================================================
-- المرحلة 8: صياغة سياسات RLS الصارمة لكل عملية (SELECT, INSERT, UPDATE, DELETE)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. جدول الملفات الشخصية (public.profiles)
-- ------------------------------------------------------------------------------

-- SELECT: يسمح للمستخدم بقراءة ملفه، أو للأدمن والمعلمين بقراءة ملفات الطلاب
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
CREATE POLICY "profiles_select_policy"
    ON public.profiles FOR SELECT
    USING (
        auth.uid() = id 
        OR public.is_teacher_or_admin()
        -- في حال الرغبة في عرض أسماء المتصدرين للعامة (اسم وأفاتار فقط)
        OR (auth.role() = 'authenticated')
    );

-- INSERT: المستخدم الموثق يسجل لنفس الـ ID فقط بشرط دور student وعدم تفعيل الاشتراك (أو الأدمن)
DROP POLICY IF EXISTS "profiles_insert_policy" ON public.profiles;
CREATE POLICY "profiles_insert_policy"
    ON public.profiles FOR INSERT
    WITH CHECK (
        (public.is_authenticated() AND auth.uid() = id AND role = 'student'::public.user_role AND is_subscribed = false)
        OR public.is_admin()
    );

-- UPDATE: المستخدم يعدل ملفه فقط (مع حماية الحقول الحساسة بالتريجر) أو الأدمن
DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;
CREATE POLICY "profiles_update_policy"
    ON public.profiles FOR UPDATE
    USING (
        (public.is_authenticated() AND auth.uid() = id) 
        OR public.is_admin()
    )
    WITH CHECK (
        (public.is_authenticated() AND auth.uid() = id) 
        OR public.is_admin()
    );

-- DELETE: محصور بالسوبر أدمن فقط لمنع تخريب الحسابات
DROP POLICY IF EXISTS "profiles_delete_policy" ON public.profiles;
CREATE POLICY "profiles_delete_policy"
    ON public.profiles FOR DELETE
    USING (
        public.is_super_admin()
    );

-- ------------------------------------------------------------------------------
-- 2. جدول محاولات ونتائج الاختبارات (public.user_quiz_attempts) - منع التلاعب بالنتائج
-- ------------------------------------------------------------------------------

-- SELECT: الطالب يرى نتائج نفسه فقط، أو المعلمون والأدمن
DROP POLICY IF EXISTS "attempts_select_policy" ON public.user_quiz_attempts;
CREATE POLICY "attempts_select_policy"
    ON public.user_quiz_attempts FOR SELECT
    USING (
        (public.is_authenticated() AND auth.uid() = user_id) 
        OR public.is_teacher_or_admin()
    );

-- INSERT: فقط الطالب الموثق لنفسه حصراً (ممنوع إدراج نتيجة باسم طالب آخر)
DROP POLICY IF EXISTS "attempts_insert_policy" ON public.user_quiz_attempts;
CREATE POLICY "attempts_insert_policy"
    ON public.user_quiz_attempts FOR INSERT
    WITH CHECK (
        public.is_authenticated() 
        AND auth.uid() = user_id
        AND score >= 0.00 
        AND score <= 100.00
    );

-- UPDATE: 🚨 غير مسموح بتعديل نتيجة الاختبار بتاتاً للطلاب! محصور بالأدمن فقط للإصلاحات النادرة
DROP POLICY IF EXISTS "attempts_update_policy" ON public.user_quiz_attempts;
CREATE POLICY "attempts_update_policy"
    ON public.user_quiz_attempts FOR UPDATE
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- DELETE: محصور بالأدمن فقط
DROP POLICY IF EXISTS "attempts_delete_policy" ON public.user_quiz_attempts;
CREATE POLICY "attempts_delete_policy"
    ON public.user_quiz_attempts FOR DELETE
    USING (public.is_admin());

-- ------------------------------------------------------------------------------
-- 3. جدول الأسئلة المحفوظة (public.saved_questions)
-- ------------------------------------------------------------------------------

DROP POLICY IF EXISTS "saved_questions_select_policy" ON public.saved_questions;
CREATE POLICY "saved_questions_select_policy"
    ON public.saved_questions FOR SELECT
    USING (public.is_authenticated() AND auth.uid() = user_id);

DROP POLICY IF EXISTS "saved_questions_insert_policy" ON public.saved_questions;
CREATE POLICY "saved_questions_insert_policy"
    ON public.saved_questions FOR INSERT
    WITH CHECK (public.is_authenticated() AND auth.uid() = user_id);

DROP POLICY IF EXISTS "saved_questions_update_policy" ON public.saved_questions;
CREATE POLICY "saved_questions_update_policy"
    ON public.saved_questions FOR UPDATE
    USING (public.is_authenticated() AND auth.uid() = user_id)
    WITH CHECK (public.is_authenticated() AND auth.uid() = user_id);

DROP POLICY IF EXISTS "saved_questions_delete_policy" ON public.saved_questions;
CREATE POLICY "saved_questions_delete_policy"
    ON public.saved_questions FOR DELETE
    USING (public.is_authenticated() AND auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- 4. جدول بنك الأسئلة (public.questions)
-- ------------------------------------------------------------------------------

-- SELECT: المنشور فقط للطلاب والزوار، وكل الأسئلة للمعلم والأدمن
DROP POLICY IF EXISTS "questions_select_policy" ON public.questions;
CREATE POLICY "questions_select_policy"
    ON public.questions FOR SELECT
    USING (
        is_published = TRUE 
        OR public.is_teacher_or_admin()
    );

-- INSERT / UPDATE / DELETE: محصورة بالمعلم والمسؤول فقط (الطلاب والزوار ممنوعون تماماً)
DROP POLICY IF EXISTS "questions_insert_policy" ON public.questions;
CREATE POLICY "questions_insert_policy"
    ON public.questions FOR INSERT
    WITH CHECK (public.is_teacher_or_admin());

DROP POLICY IF EXISTS "questions_update_policy" ON public.questions;
CREATE POLICY "questions_update_policy"
    ON public.questions FOR UPDATE
    USING (public.is_teacher_or_admin())
    WITH CHECK (public.is_teacher_or_admin());

DROP POLICY IF EXISTS "questions_delete_policy" ON public.questions;
CREATE POLICY "questions_delete_policy"
    ON public.questions FOR DELETE
    USING (public.is_teacher_or_admin());

-- ------------------------------------------------------------------------------
-- 5. جدول الاختبارات (public.quizzes) وجدول الربط (public.quiz_questions)
-- ------------------------------------------------------------------------------

DROP POLICY IF EXISTS "quizzes_select_policy" ON public.quizzes;
CREATE POLICY "quizzes_select_policy"
    ON public.quizzes FOR SELECT
    USING (is_published = TRUE OR public.is_teacher_or_admin());

DROP POLICY IF EXISTS "quizzes_insert_policy" ON public.quizzes;
CREATE POLICY "quizzes_insert_policy"
    ON public.quizzes FOR INSERT
    WITH CHECK (public.is_teacher_or_admin());

DROP POLICY IF EXISTS "quizzes_update_policy" ON public.quizzes;
CREATE POLICY "quizzes_update_policy"
    ON public.quizzes FOR UPDATE
    USING (public.is_teacher_or_admin())
    WITH CHECK (public.is_teacher_or_admin());

DROP POLICY IF EXISTS "quizzes_delete_policy" ON public.quizzes;
CREATE POLICY "quizzes_delete_policy"
    ON public.quizzes FOR DELETE
    USING (public.is_teacher_or_admin());

DROP POLICY IF EXISTS "quiz_questions_select_policy" ON public.quiz_questions;
CREATE POLICY "quiz_questions_select_policy"
    ON public.quiz_questions FOR SELECT
    USING (TRUE);

DROP POLICY IF EXISTS "quiz_questions_write_policy" ON public.quiz_questions;
CREATE POLICY "quiz_questions_write_policy"
    ON public.quiz_questions FOR ALL
    USING (public.is_teacher_or_admin())
    WITH CHECK (public.is_teacher_or_admin());

-- ------------------------------------------------------------------------------
-- 6. جداول الأقسام والمواضيع (public.categories & public.topics)
-- ------------------------------------------------------------------------------

DROP POLICY IF EXISTS "categories_select_policy" ON public.categories;
CREATE POLICY "categories_select_policy"
    ON public.categories FOR SELECT
    USING (is_active = TRUE OR public.is_teacher_or_admin());

DROP POLICY IF EXISTS "categories_insert_policy" ON public.categories;
CREATE POLICY "categories_insert_policy"
    ON public.categories FOR INSERT
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "categories_update_policy" ON public.categories;
CREATE POLICY "categories_update_policy"
    ON public.categories FOR UPDATE
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "categories_delete_policy" ON public.categories;
CREATE POLICY "categories_delete_policy"
    ON public.categories FOR DELETE
    USING (public.is_admin());

DROP POLICY IF EXISTS "topics_select_policy" ON public.topics;
CREATE POLICY "topics_select_policy"
    ON public.topics FOR SELECT
    USING (TRUE);

DROP POLICY IF EXISTS "topics_write_policy" ON public.topics;
CREATE POLICY "topics_write_policy"
    ON public.topics FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ------------------------------------------------------------------------------
-- 7. جداول المحاضرات والدروس والمذكرات (إن وجدت)
-- ------------------------------------------------------------------------------

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'modules') THEN
        DROP POLICY IF EXISTS "modules_select" ON public.modules;
        DROP POLICY IF EXISTS "modules_write" ON public.modules;
        CREATE POLICY "modules_select" ON public.modules FOR SELECT USING (is_published = TRUE OR public.is_teacher_or_admin());
        CREATE POLICY "modules_write" ON public.modules FOR ALL USING (public.is_teacher_or_admin()) WITH CHECK (public.is_teacher_or_admin());
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'lessons') THEN
        DROP POLICY IF EXISTS "lessons_select" ON public.lessons;
        DROP POLICY IF EXISTS "lessons_write" ON public.lessons;
        CREATE POLICY "lessons_select" ON public.lessons FOR SELECT USING (is_published = TRUE OR public.is_teacher_or_admin());
        CREATE POLICY "lessons_write" ON public.lessons FOR ALL USING (public.is_teacher_or_admin()) WITH CHECK (public.is_teacher_or_admin());
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'lesson_attachments') THEN
        DROP POLICY IF EXISTS "attachments_select" ON public.lesson_attachments;
        DROP POLICY IF EXISTS "attachments_write" ON public.lesson_attachments;
        CREATE POLICY "attachments_select" ON public.lesson_attachments FOR SELECT USING (TRUE);
        CREATE POLICY "attachments_write" ON public.lesson_attachments FOR ALL USING (public.is_teacher_or_admin()) WITH CHECK (public.is_teacher_or_admin());
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_lesson_progress') THEN
        DROP POLICY IF EXISTS "progress_select" ON public.user_lesson_progress;
        DROP POLICY IF EXISTS "progress_insert" ON public.user_lesson_progress;
        DROP POLICY IF EXISTS "progress_update" ON public.user_lesson_progress;
        CREATE POLICY "progress_select" ON public.user_lesson_progress FOR SELECT USING (public.is_authenticated() AND auth.uid() = user_id);
        CREATE POLICY "progress_insert" ON public.user_lesson_progress FOR INSERT WITH CHECK (public.is_authenticated() AND auth.uid() = user_id);
        CREATE POLICY "progress_update" ON public.user_lesson_progress FOR UPDATE USING (public.is_authenticated() AND auth.uid() = user_id) WITH CHECK (public.is_authenticated() AND auth.uid() = user_id);
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 8. جدول سجل التدقيق الأمني (public.role_change_logs) - سجل غير قابل للتعديل
-- ------------------------------------------------------------------------------

-- SELECT: محصور بالمسؤولين فقط
DROP POLICY IF EXISTS "role_logs_select_policy" ON public.role_change_logs;
CREATE POLICY "role_logs_select_policy"
    ON public.role_change_logs FOR SELECT
    USING (public.is_admin());

-- INSERT: فقط المسؤولين أو عبر دوال النظام
DROP POLICY IF EXISTS "role_logs_insert_policy" ON public.role_change_logs;
CREATE POLICY "role_logs_insert_policy"
    ON public.role_change_logs FOR INSERT
    WITH CHECK (public.is_admin());

-- UPDATE & DELETE: مرفوضان تماماً لأي مستخدم لحماية نزاهة السجل (Immutable Audit Trail)
-- عدم وجود سياسة UPDATE أو DELETE يعني المنع التلقائي للجميع (Deny by Default)

-- ==============================================================================
-- المرحلة 9: تأمين مساحات التخزين السحابية (Supabase Storage RLS)
-- ==============================================================================

-- إتاحة القراءة فقط للـ Buckets العامة
DROP POLICY IF EXISTS "Public read storage images" ON storage.objects;
CREATE POLICY "Public read storage images"
    ON storage.objects FOR SELECT
    USING (bucket_id IN ('question-images', 'lecture-files'));

-- الرفع والتعديل والحذف مقصور على المعلمين والإدارة
DROP POLICY IF EXISTS "Teacher admin write storage" ON storage.objects;
CREATE POLICY "Teacher admin write storage"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id IN ('question-images', 'lecture-files') 
        AND public.is_teacher_or_admin()
    );

DROP POLICY IF EXISTS "Teacher admin update storage" ON storage.objects;
CREATE POLICY "Teacher admin update storage"
    ON storage.objects FOR UPDATE
    USING (
        bucket_id IN ('question-images', 'lecture-files') 
        AND public.is_teacher_or_admin()
    );

DROP POLICY IF EXISTS "Teacher admin delete storage" ON storage.objects;
CREATE POLICY "Teacher admin delete storage"
    ON storage.objects FOR DELETE
    USING (
        bucket_id IN ('question-images', 'lecture-files') 
        AND public.is_teacher_or_admin()
    );

-- ==============================================================================
-- المرحلة 10: فحص وتأكيد نجاح التثبيت الأمني
-- ==============================================================================

SELECT 
    schemaname, 
    tablename, 
    rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;
