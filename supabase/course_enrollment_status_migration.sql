-- ==============================================================================
-- 🚀 سكربت ترقية قاعدة البيانات: ميزة إيقاف التسجيل المؤقت في الدورات التدريبية
-- Course Enrollment Pausing & Status Management Migration (PostgreSQL / Supabase)
-- ==============================================================================

-- 1. إنشاء نوع الحالة المخصص (Enum Type)
DO $$ BEGIN
    CREATE TYPE public.course_enrollment_status AS ENUM ('active', 'paused', 'upcoming');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. إضافة حقول حالة التسجيل لجدول الأبواب والدورات (public.modules)
ALTER TABLE public.modules 
    ADD COLUMN IF NOT EXISTS status public.course_enrollment_status NOT NULL DEFAULT 'paused',
    ADD COLUMN IF NOT EXISTS available_date TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS custom_status_text TEXT DEFAULT 'الاشتراك متاح قريباً ⏳';

-- 3. إنشاء جدول الدورات المستقل إن لم يكن موجوداً (public.courses)
CREATE TABLE IF NOT EXISTS public.courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    price_sar NUMERIC(10,2) DEFAULT 75.00 NOT NULL,
    status public.course_enrollment_status NOT NULL DEFAULT 'paused',
    available_date TIMESTAMPTZ,
    custom_status_text TEXT DEFAULT 'الاشتراك متاح قريباً ⏳',
    is_published BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- فهرس سريع للأداء
CREATE INDEX IF NOT EXISTS idx_modules_status ON public.modules(status);
CREATE INDEX IF NOT EXISTS idx_courses_status ON public.courses(status);

-- 4. إنشاء جدول الاشتراكات والتسجيلات (Course Enrollments Table)
CREATE TABLE IF NOT EXISTS public.course_enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
    module_id UUID REFERENCES public.modules(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'active', -- active, expired, cancelled
    price_paid NUMERIC(10,2) NOT NULL DEFAULT 75.00,
    enrolled_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    expires_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW() + INTERVAL '365 days') NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    CONSTRAINT uq_user_enrollment UNIQUE (user_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_enrollments_user_id ON public.course_enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_course_id ON public.course_enrollments(course_id);

-- ==============================================================================
-- 5. تريجر الحماية والأمان على مستوى قاعدة البيانات (Backend / DB Security Guard)
-- يمنع إدراج أي اشتراك جديد إذا كانت الدورة في حالة paused أو upcoming
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.check_course_enrollment_status()
RETURNS TRIGGER AS $$
DECLARE
    found_status public.course_enrollment_status;
    found_title TEXT;
    custom_notice TEXT;
BEGIN
    -- 1. فحص الحالة في جدول الدورات إن وجد course_id
    IF NEW.course_id IS NOT NULL THEN
        SELECT status, title, custom_status_text 
        INTO found_status, found_title, custom_notice
        FROM public.courses 
        WHERE id = NEW.course_id;
    END IF;

    -- 2. أو فحص الحالة في جدول modules إن وجد module_id
    IF found_status IS NULL AND NEW.module_id IS NOT NULL THEN
        SELECT status, title, custom_status_text 
        INTO found_status, found_title, custom_notice
        FROM public.modules 
        WHERE id = NEW.module_id;
    END IF;

    -- 3. في حال لم يكن أي منهما محدداً، فحص أول باب عام
    IF found_status IS NULL THEN
        SELECT status, title, custom_status_text 
        INTO found_status, found_title, custom_notice
        FROM public.modules 
        ORDER BY order_index ASC LIMIT 1;
    END IF;

    -- 4. إطلاق استثناء أمني وإلغاء العملية فوراً إذا كانت الدورة موقوفة مؤقتاً
    IF found_status IS NOT NULL AND found_status <> 'active' THEN
        RAISE EXCEPTION 'Course enrollment is currently paused. الدورة "%" مغلقة مؤقتاً للتسجيل: %', 
            COALESCE(found_title, 'المحددة'), 
            COALESCE(custom_notice, 'التسجيل متاح قريباً ⏳');
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- تفعيل التريجر على جدول التسجيلات
DROP TRIGGER IF EXISTS trigger_prevent_paused_enrollment ON public.course_enrollments;
CREATE TRIGGER trigger_prevent_paused_enrollment
    BEFORE INSERT ON public.course_enrollments
    FOR EACH ROW
    EXECUTE FUNCTION public.check_course_enrollment_status();

-- ==============================================================================
-- 6. دوال التحكم الإداري (Super Admin / Admin Stored Procedures)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.admin_set_course_status(
    target_id UUID,
    new_status public.course_enrollment_status,
    new_available_date TIMESTAMPTZ DEFAULT NULL,
    new_custom_text TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    is_authorized BOOLEAN := FALSE;
    updated_count INT := 0;
BEGIN
    -- التحقق من صلاحية المشرف
    IF public.is_super_admin() OR public.is_admin() OR public.is_teacher() THEN
        is_authorized := TRUE;
    END IF;

    IF NOT is_authorized THEN
        RAISE EXCEPTION 'Access Denied: Only teachers or admins can update course status.';
    END IF;

    -- تحديث في جدول الأبواب
    UPDATE public.modules
    SET 
        status = new_status,
        available_date = new_available_date,
        custom_status_text = COALESCE(new_custom_text, custom_status_text),
        updated_at = NOW()
    WHERE id = target_id;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;

    -- تحديث في جدول الدورات إن لم يوجد في الأبواب
    IF updated_count = 0 THEN
        UPDATE public.courses
        SET 
            status = new_status,
            available_date = new_available_date,
            custom_status_text = COALESCE(new_custom_text, custom_status_text),
            updated_at = NOW()
        WHERE id = target_id;
    END IF;

    RETURN jsonb_build_object(
        'success', TRUE,
        'status', new_status,
        'message', 'تم تحديث حالة التسجيل في الدورة بنجاح'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
