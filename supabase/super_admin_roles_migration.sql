-- ==============================================================================
-- 👑 منصة طرقع للكمي - سكربت ترقية نظام إدارة الرتب والصلاحيات (Super Admin RBAC)
-- متوافق بالكامل مع Supabase PostgreSQL 15+ و Custom Claims
-- ==============================================================================

-- 1. إضافة رتبة 'super_admin' إلى نوع الأدوار user_role إذا لم تكن موجودة
DO $$ BEGIN
    ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'super_admin';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. إنشاء جدول سجل تدقيق تغييرات الرتب (Role Change Audit Logs)
CREATE TABLE IF NOT EXISTS public.role_change_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    target_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    old_role public.user_role NOT NULL,
    new_role public.user_role NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- فهارس سريعة لسجل العمليات
CREATE INDEX IF NOT EXISTS idx_role_logs_target ON public.role_change_logs(target_user_id);
CREATE INDEX IF NOT EXISTS idx_role_logs_admin ON public.role_change_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_role_logs_created ON public.role_change_logs(created_at DESC);

-- ==============================================================================
-- 3. الدوال الأمنية المحدثة للتحقق من الصلاحيات (Security Definer Functions)
-- ==============================================================================

-- أ. التحقق مما إذا كان المستخدم سوبر أدمن (Super Admin)
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean AS $$
DECLARE
    v_role text;
BEGIN
    -- 1. فحص توكن JWT أولاً لتقليل كلفة الاستعلام
    v_role := (auth.jwt() -> 'app_metadata' ->> 'role');
    IF v_role = 'super_admin' THEN
        RETURN true;
    END IF;

    -- 2. الاستعلام المباشر من جدول profiles
    RETURN EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'super_admin'
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth;

-- ب. فحص إذا كان المستخدم مديراً أو سوبر أدمن (Admin or Super Admin)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
DECLARE
    v_role text;
BEGIN
    v_role := (auth.jwt() -> 'app_metadata' ->> 'role');
    IF v_role IN ('admin', 'super_admin') THEN
        RETURN true;
    END IF;

    RETURN EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth;

-- ج. فحص إذا كان المستخدم معلماً أو مديراً أو سوبر أدمن
CREATE OR REPLACE FUNCTION public.is_teacher()
RETURNS boolean AS $$
DECLARE
    v_role text;
BEGIN
    v_role := (auth.jwt() -> 'app_metadata' ->> 'role');
    IF v_role IN ('teacher', 'admin', 'super_admin') THEN
        RETURN true;
    END IF;

    RETURN EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role IN ('teacher', 'admin', 'super_admin')
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth;

-- د. فحص مرن للأدوار
CREATE OR REPLACE FUNCTION public.has_role(required_role public.user_role)
RETURNS boolean AS $$
BEGIN
    IF public.is_super_admin() THEN
        RETURN true; -- السوبر أدمن يمتلك كل الصلاحيات في المنصة
    END IF;
    
    IF required_role = 'admin' AND public.is_admin() THEN
        RETURN true;
    END IF;

    IF required_role = 'teacher' AND public.is_teacher() THEN
        RETURN true;
    END IF;

    RETURN (public.get_current_user_role() = required_role);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth;

-- ==============================================================================
-- 4. التريجر الأمني الصارم للتحكم في تعديل الرتب (Role Escalation & Demotion Guard)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.prevent_unauthorized_role_change()
RETURNS TRIGGER AS $$
DECLARE
    v_super_admin_count integer;
BEGIN
    -- إذا تغير حقل الدور
    IF NEW.role IS DISTINCT FROM OLD.role THEN
        -- 1. التحقق الصارم: السوبر أدمن حصراً هو المصرح له بتغيير أي رتبة
        IF NOT public.is_super_admin() THEN
            RAISE EXCEPTION 'عملية غير مصرح بها: لا يمكن ترقية أو سحب صلاحيات ورتب المستخدمين إلا بواسطة السوبر أدمن (Super Admin) حصراً.';
        END IF;

        -- 2. حماية النظام: منع السوبر أدمن من سحب رتبة نفسه إذا كان هو السوبر أدمن الوحيد
        IF OLD.role = 'super_admin' AND NEW.role != 'super_admin' THEN
            SELECT COUNT(*) INTO v_super_admin_count
            FROM public.profiles
            WHERE role = 'super_admin';

            IF v_super_admin_count <= 1 THEN
                RAISE EXCEPTION 'عملية مرفوضة أمنياً: لا يمكن سحب رتبة السوبر أدمن لأنك السوبر أدمن الوحيد المسجل في المنصة!';
            END IF;
        END IF;

        -- 3. تسجيل حركة التعديل تلقائياً في سجل التدقيق
        INSERT INTO public.role_change_logs (
            admin_id,
            target_user_id,
            old_role,
            new_role,
            reason,
            created_at
        ) VALUES (
            COALESCE(auth.uid(), NEW.id),
            NEW.id,
            OLD.role,
            NEW.role,
            'تعديل يدوي عبر لوحة تحكم السوبر أدمن',
            now()
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- إعادة ربط التريجر بجدول profiles
DROP TRIGGER IF EXISTS trg_prevent_role_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_role_escalation
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_unauthorized_role_change();

-- ==============================================================================
-- 5. تفعيل سياسات أمان مستوى الصف (RLS) لسجل تغيير الرتب
-- ==============================================================================

ALTER TABLE public.role_change_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "سوبر أدمن فقط يمكنه قراءة سجل تغيير الرتب" ON public.role_change_logs;
CREATE POLICY "سوبر أدمن فقط يمكنه قراءة سجل تغيير الرتب"
    ON public.role_change_logs FOR SELECT
    USING (public.is_super_admin());

DROP POLICY IF EXISTS "سوبر أدمن فقط يمكنه تسجيل تغيير الرتب" ON public.role_change_logs;
CREATE POLICY "سوبر أدمن فقط يمكنه تسجيل تغيير الرتب"
    ON public.role_change_logs FOR INSERT
    WITH CHECK (public.is_super_admin());

-- ==============================================================================
-- 6. تعيين السوبر أدمن الرئيسي (Primary Super Admin Assignment)
-- ==============================================================================

-- تعيين المستخدم Yassien Ahmed كسوبر أدمن في profiles
UPDATE public.profiles
SET role = 'super_admin', full_name = 'Yassien Ahmed'
WHERE email = 'yassooooo27m@gmail.com';

-- مزامنة رتبة السوبر أدمن مع JWT Custom Claims في auth.users
UPDATE auth.users
SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role": "super_admin"}'::jsonb
WHERE email = 'yassooooo27m@gmail.com';

-- إذا لم يكن مسجلاً بعد، تعيين أول مستخدم كـ super_admin كإجراء احتياطي
DO $$ 
DECLARE
    v_first_user_id uuid;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE role = 'super_admin') THEN
        SELECT id INTO v_first_user_id FROM public.profiles ORDER BY created_at ASC LIMIT 1;
        IF v_first_user_id IS NOT NULL THEN
            UPDATE public.profiles SET role = 'super_admin' WHERE id = v_first_user_id;
        END IF;
    END IF;
END $$;
