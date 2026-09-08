-- ==============================================================================
-- 👑 منصة طرقع للكمي - سكربت حصر السوبر أدمن في شخص واحد وإصلاح المصادقة
-- Single Super Admin Constraint & Complete Auth Fix Script
-- متوافق 100% مع Supabase PostgreSQL 15+ و Row Level Security (RLS)
-- ==============================================================================

-- تفعيل الامتدادات الضرورية
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. التأكد من وجود رتبة 'super_admin' في نوع الأدوار user_role
-- ------------------------------------------------------------------------------
DO $$ BEGIN
    ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'super_admin';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ------------------------------------------------------------------------------
-- 2. تنظيف السجلات المكررة وضمان تعيين المالك الأساسي فقط كسوبر أدمن
-- ------------------------------------------------------------------------------
-- أولاً: تخفيض أي حساب آخر يحمل رتبة super_admin إلى رتبة admin، باستثناء المالك
UPDATE public.profiles
SET role = 'admin'
WHERE role = 'super_admin' AND LOWER(TRIM(email)) <> 'yassooooo27m@gmail.com';

-- ثانياً: تعيين حساب المالك الأساسي كسوبر أدمن رسمي للمنصة
UPDATE public.profiles
SET role = 'super_admin', full_name = 'Yassien Ahmed'
WHERE LOWER(TRIM(email)) = 'yassooooo27m@gmail.com';

-- ثالثاً: مزامنة رتبة السوبر أدمن في جدول auth.users (Custom Claims)
UPDATE auth.users
SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role": "super_admin"}'::jsonb
WHERE LOWER(TRIM(email)) = 'yassooooo27m@gmail.com';

-- ------------------------------------------------------------------------------
-- 3. القيد الصارم على مستوى قاعدة البيانات: فهرس فريد جزئي (Unique Partial Index)
-- يضمن رياضياً وقاعدياً استحالة وجود أكثر من صف واحد برتبة 'super_admin'
-- ------------------------------------------------------------------------------
DROP INDEX IF EXISTS public.idx_single_super_admin;

CREATE UNIQUE INDEX idx_single_super_admin 
ON public.profiles (role) 
WHERE role = 'super_admin';

COMMENT ON INDEX public.idx_single_super_admin IS 
'قيد صارم يمنع وجود أكثر من حساب واحد برتبة super_admin في جدول profiles';

-- ------------------------------------------------------------------------------
-- 4. تريجر الحماية البرمجية لمنع الترقية غير المصرح بها (Prevent Multiple Super Admins Trigger)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_single_super_admin()
RETURNS TRIGGER AS $$
DECLARE
    v_existing_super_admin_id uuid;
    v_existing_super_admin_email text;
BEGIN
    -- أ. في حالة محاولة تعيين مستخدم كرتبة super_admin
    IF NEW.role = 'super_admin' THEN
        -- التحقق من وجود سوبر أدمن نشط آخر
        SELECT id, email INTO v_existing_super_admin_id, v_existing_super_admin_email
        FROM public.profiles
        WHERE role = 'super_admin' AND id <> NEW.id
        LIMIT 1;

        IF v_existing_super_admin_id IS NOT NULL THEN
            RAISE EXCEPTION 
                'عملية مرفوضة أمنياً: لا يمكن وجود أكثر من حساب سوبر أدمن (Super Admin) واحد في منصة طرقع. السوبر أدمن الحالي هو (%). يجب التنازل عن الرتبة أو نقلها في معاملة واحدة (Transaction).'
                , COALESCE(v_existing_super_admin_email, 'الحساب المالك')
                USING ERRCODE = '23505'; -- Unique violation error code
        END IF;
    END IF;

    -- ب. في حالة محاولة إزالة رتبة السوبر أدمن الوحيد (تجريده دون بديل)
    IF TG_OP = 'UPDATE' AND OLD.role = 'super_admin' AND NEW.role <> 'super_admin' THEN
        -- منع ترك المنصة بدون سوبر أدمن
        IF NOT EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE role = 'super_admin' AND id <> OLD.id
        ) THEN
            RAISE EXCEPTION 
                'عملية مرفوضة: لا يمكن سحب رتبة السوبر أدمن من هذا الحساب، لأنه السوبر أدمن الوحيد في النظام! يجب تعيين سوبر أدمن جديد أولاً في نفس المعاملة.'
                USING ERRCODE = '23514'; -- Check violation
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- ربط التريجر بجدول profiles
DROP TRIGGER IF EXISTS trg_enforce_single_super_admin ON public.profiles;

CREATE TRIGGER trg_enforce_single_super_admin
    BEFORE INSERT OR UPDATE OF role ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_single_super_admin();

-- ------------------------------------------------------------------------------
-- 5. تريجر مزامنة الدور تلقائياً إلى JWT App Metadata في auth.users
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
-- 6. تحديث دالة تسجيل المستخدمين الجدد (handle_new_user)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_initial_role public.user_role := 'student';
    v_has_super_admin boolean;
BEGIN
    -- فحص ما إذا كان هناك سوبر أدمن في النظام
    SELECT EXISTS (SELECT 1 FROM public.profiles WHERE role = 'super_admin') 
    INTO v_has_super_admin;

    -- إعطاء رتبة super_admin حصرياً لإيميل المالك الأساسي إذا لم يكن هناك سوبر أدمن
    IF LOWER(TRIM(NEW.email)) = 'yassooooo27m@gmail.com' AND NOT v_has_super_admin THEN
        v_initial_role := 'super_admin';
    ELSIF NEW.raw_app_meta_data->>'role' IS NOT NULL THEN
        BEGIN
            -- منع أي مستخدم جديد من ادعاء رتبة super_admin في metadata
            IF (NEW.raw_app_meta_data->>'role') = 'super_admin' THEN
                IF LOWER(TRIM(NEW.email)) = 'yassooooo27m@gmail.com' THEN
                    v_initial_role := 'super_admin';
                ELSE
                    v_initial_role := 'student';
                END IF;
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
            WHEN LOWER(TRIM(EXCLUDED.email)) = 'yassooooo27m@gmail.com' THEN 'super_admin'::public.user_role 
            ELSE profiles.role 
        END,
        updated_at = NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- إعادة تفعيل تريجر إنشاء المستخدم في auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ------------------------------------------------------------------------------
-- 7. دوال التحقق الأمني RLS المحدثة (Security Definer Helpers)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean AS $$
BEGIN
    -- 1. فحص توكن JWT أولاً لتقليل تكلفة الاستعلام
    IF (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin' THEN
        RETURN true;
    END IF;

    -- 2. التحقق المباشر من جدول profiles للحساب الموثق
    RETURN EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'super_admin'
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
    IF (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin') THEN
        RETURN true;
    END IF;

    RETURN EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth;

-- ------------------------------------------------------------------------------
-- 8. جدول سجل تغييرات الرتب وحمايته (Audit Logs)
-- ------------------------------------------------------------------------------
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
CREATE POLICY "قراءة سجل الرتب للسوبر أدمن فقط"
    ON public.role_change_logs FOR SELECT
    USING (public.is_super_admin());

DROP POLICY IF EXISTS "إدراج سجل الرتب للسوبر أدمن فقط" ON public.role_change_logs;
CREATE POLICY "إدراج سجل الرتب للسوبر أدمن فقط"
    ON public.role_change_logs FOR INSERT
    WITH CHECK (public.is_super_admin());

-- ==============================================================================
-- انتهى السكربت بنجاح: تم تأمين رتبة السوبر أدمن كحساب فريد وحيد، ومزامنة المصادقة.
-- ==============================================================================
