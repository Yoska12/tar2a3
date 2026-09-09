-- ==============================================================================
-- 🛡️ منصة طرقع للكمي - سكربت حظر وحذف المستخدمين (Ban & Delete User System)
-- متوافق مع Supabase PostgreSQL و RLS والدوال الأمنية Security Definer
-- ==============================================================================

-- 1. إضافة حقول الحظر إلى جدول public.profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ban_reason TEXT DEFAULT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS banned_at TIMESTAMPTZ DEFAULT NULL;

-- إنشاء فهارس سريعة لفلترة الحسابات المحظورة
CREATE INDEX IF NOT EXISTS idx_profiles_is_banned ON public.profiles(is_banned);

-- ==============================================================================
-- 2. دالة أمنية لحظر أو فك حظر حساب (Admin Toggle Ban)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.admin_toggle_ban_user(
    target_user_id UUID,
    p_is_banned BOOLEAN,
    p_reason TEXT DEFAULT NULL
)
RETURNS boolean AS $$
DECLARE
    v_is_owner boolean;
BEGIN
    -- التحقق من صلاحيات المنفذ (يجب أن يكون Admin أو Super Admin)
    IF NOT (public.is_super_admin() OR public.is_admin()) THEN
        RAISE EXCEPTION 'غير مصرح: هذه العملية متاحة للمسؤولين فقط.';
    END IF;

    -- منع حظر حساب المالك الأساسي نهائياً
    SELECT (email = 'yassooooo27m@gmail.com' OR role = 'super_admin') INTO v_is_owner
    FROM public.profiles
    WHERE id = target_user_id;

    IF v_is_owner THEN
        RAISE EXCEPTION 'خطأ أمني: لا يمكن حظر حساب السوبر أدمن الرئيسي للمنصة.';
    END IF;

    -- تحديث حالة الحظر
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
-- 3. دالة أمنية لحذف حساب مستخدم نهائياً من النظام (Admin Delete User)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.admin_delete_user(
    target_user_id UUID
)
RETURNS boolean AS $$
DECLARE
    v_is_owner boolean;
BEGIN
    -- التحقق من صلاحيات المنفذ
    IF NOT (public.is_super_admin() OR public.is_admin()) THEN
        RAISE EXCEPTION 'غير مصرح: لا تملك الصلاحية لحذف الحسابات.';
    END IF;

    -- منع حذف حساب المالك الأساسي نهائياً
    SELECT (email = 'yassooooo27m@gmail.com' OR role = 'super_admin') INTO v_is_owner
    FROM public.profiles
    WHERE id = target_user_id;

    IF v_is_owner THEN
        RAISE EXCEPTION 'خطأ أمني: لا يمكن مسح حساب السوبر أدمن الرئيسي للمنصة.';
    END IF;

    -- حذف سجلات تدقيق الرتب المرتبطة به إن وجدت
    DELETE FROM public.role_change_logs 
    WHERE target_user_id = target_user_id OR admin_id = target_user_id;

    -- حذف سجل الملف الشخصي من public.profiles
    DELETE FROM public.profiles WHERE id = target_user_id;

    -- حذف الحساب نهائياً من auth.users (إذا توفرت الصلاحية على سكيمة auth)
    BEGIN
        DELETE FROM auth.users WHERE id = target_user_id;
    EXCEPTION
        WHEN OTHERS THEN
            -- إذا كان هناك قيود مفاتيح خارجية على جداول أخرى
            NULL;
    END;

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- تفعيل صلاحيات تشغيل الدوال
GRANT EXECUTE ON FUNCTION public.admin_toggle_ban_user(UUID, BOOLEAN, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(UUID) TO authenticated;
