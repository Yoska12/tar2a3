-- ==============================================================================
-- 🛡️ منصة طرقع للكمي - سكربت ترقية نظام الصلاحيات المتقدم (RBAC Migration Script)
-- متوافق بالكامل مع Supabase PostgreSQL 15+ و Custom Claims
-- ==============================================================================

-- 1. إنشاء النوع المخصص للأدوار (Custom Role Enum)
DO $$ BEGIN
    CREATE TYPE public.user_role AS ENUM ('student', 'teacher', 'admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. تحديث جدول الملفات الشخصية (Profiles) بإضافة عمود الدور وحقول التليجرام
ALTER TABLE public.profiles 
    ADD COLUMN IF NOT EXISTS role public.user_role NOT NULL DEFAULT 'student',
    ADD COLUMN IF NOT EXISTS telegram_linked_at TIMESTAMPTZ;

-- فهرس سريع للبحث والفلترة حسب الدور
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- ==============================================================================
-- 3. الدوال الأمنية المساعدة للتحقق من الصلاحيات (Security Definer Functions)
-- تم تحديد search_path صراحةً لمنع هجمات حقن المسارات (Path Injection)
-- ==============================================================================

-- أ. جلب دور المستخدم الحالي (من الـ JWT Claims أولاً ثم من جدول profiles)
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS public.user_role AS $$
DECLARE
    v_role public.user_role;
    v_jwt_role text;
BEGIN
    -- 1. فحص توكن الـ JWT للحصول على الدور بشكل فوري بدون كلفة استعلام (Zero DB Latency)
    v_jwt_role := (auth.jwt() -> 'app_metadata' ->> 'role');
    IF v_jwt_role IS NOT NULL THEN
        RETURN v_jwt_role::public.user_role;
    END IF;

    -- 2. الاستعلام من جدول profiles كإجراء احتياطي
    SELECT role INTO v_role 
    FROM public.profiles 
    WHERE id = auth.uid();

    RETURN COALESCE(v_role, 'student'::public.user_role);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth;

-- ب. فحص إذا كان المستخدم مديراً (Admin)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
    RETURN (public.get_current_user_role() = 'admin');
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth;

-- ج. فحص إذا كان المستخدم معلماً أو مديراً (Teacher or Admin)
CREATE OR REPLACE FUNCTION public.is_teacher()
RETURNS boolean AS $$
BEGIN
    RETURN (public.get_current_user_role() IN ('teacher', 'admin'));
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth;

-- د. فحص مرن لأي دور محدد
CREATE OR REPLACE FUNCTION public.has_role(required_role public.user_role)
RETURNS boolean AS $$
BEGIN
    IF public.is_admin() THEN
        RETURN true; -- المدير يمتلك كافة الصلاحيات
    END IF;
    RETURN (public.get_current_user_role() = required_role);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth;

-- ==============================================================================
-- 4. التريجرز الأمنية الصارمة (Security Triggers)
-- ==============================================================================

-- أ. منع تصعيد الصلاحيات (Privilege Escalation Guard)
-- يمنع أي مستخدم عادي أو معلم من تغيير عمود 'role' في ملفه الشخصي عبر الـ API
CREATE OR REPLACE FUNCTION public.prevent_unauthorized_role_change()
RETURNS TRIGGER AS $$
BEGIN
    -- إذا تغير حقل الدور والمستخدم الحالي ليس مديراً حقيقياً
    IF NEW.role IS DISTINCT FROM OLD.role THEN
        IF NOT public.is_admin() THEN
            RAISE EXCEPTION 'عملية غير مصرح بها: لا يمكن تعديل صلاحيات وأدوار المستخدمين إلا بواسطة المشرف العام (Admin) فقط.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

DROP TRIGGER IF EXISTS trg_prevent_role_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_role_escalation
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_unauthorized_role_change();

-- ب. مزامنة الدور تلقائياً إلى raw_app_meta_data في auth.users (Custom Claims)
-- هذا يضمن أن التوكن القادم للفرونت إند والميدلوير يحتوي على الدور فورياً
CREATE OR REPLACE FUNCTION public.sync_role_to_auth_app_metadata()
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
    EXECUTE FUNCTION public.sync_role_to_auth_app_metadata();

-- ج. تحديث دالة handle_new_user لتهيئة الدور وحقول التليجرام بأمان
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_initial_role public.user_role := 'student';
BEGIN
    -- إذا حُدد دور في raw_app_meta_data من قبل لوحة الإدارة
    IF NEW.raw_app_meta_data->>'role' IS NOT NULL THEN
        BEGIN
            v_initial_role := (NEW.raw_app_meta_data->>'role')::public.user_role;
        EXCEPTION WHEN OTHERS THEN
            v_initial_role := 'student';
        END;
    END IF;

    INSERT INTO public.profiles (
        id, 
        full_name, 
        avatar_url, 
        target_score,
        role,
        telegram_id,
        telegram_username,
        telegram_chat_id,
        telegram_linked_at
    )
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', 'طالب طرقع'),
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
        COALESCE((NEW.raw_user_meta_data->>'target_score')::int, 100),
        v_initial_role,
        (NEW.raw_user_meta_data->>'telegram_id')::bigint,
        NEW.raw_user_meta_data->>'telegram_username',
        (NEW.raw_user_meta_data->>'telegram_chat_id')::bigint,
        CASE WHEN (NEW.raw_user_meta_data->>'telegram_id') IS NOT NULL THEN NOW() ELSE NULL END
    )
    ON CONFLICT (id) DO UPDATE SET
        telegram_id = COALESCE(EXCLUDED.telegram_id, profiles.telegram_id),
        telegram_username = COALESCE(EXCLUDED.telegram_username, profiles.telegram_username),
        telegram_chat_id = COALESCE(EXCLUDED.telegram_chat_id, profiles.telegram_chat_id),
        telegram_linked_at = COALESCE(EXCLUDED.telegram_linked_at, profiles.telegram_linked_at);
        
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- ==============================================================================
-- 5. تجديد سياسات أمان مستوى الصف (Row Level Security - RLS) لكل الجداول
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- أ. جدول Profiles (الملفات الشخصية)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Teachers can view student profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
DROP POLICY IF EXISTS "Only admins can delete profiles" ON public.profiles;
DROP POLICY IF EXISTS "Profiles view policy" ON public.profiles;
DROP POLICY IF EXISTS "Profiles update policy" ON public.profiles;
DROP POLICY IF EXISTS "Profiles delete policy" ON public.profiles;

-- القراءة: الطالب يرى ملفه، والمدير والمعلم يريان جميع الملفات للمتابعة
CREATE POLICY "Profiles view policy"
    ON public.profiles FOR SELECT
    USING (
        auth.uid() = id 
        OR public.is_teacher()
    );

-- التعديل: الطالب يعدل ملفه الشخصي فقط (محمي بتريجر عدم تغيير الدور)، والمدير يعدل أي ملف
CREATE POLICY "Profiles update policy"
    ON public.profiles FOR UPDATE
    USING (
        auth.uid() = id 
        OR public.is_admin()
    )
    WITH CHECK (
        auth.uid() = id 
        OR public.is_admin()
    );

-- الحذف: مقتصر حصراً على المدير (Admin) لمنع تدمير البيانات
CREATE POLICY "Profiles delete policy"
    ON public.profiles FOR DELETE
    USING (public.is_admin());

-- ------------------------------------------------------------------------------
-- ب. جدولي Categories & Topics (الأقسام والمواضيع)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Categories are publicly viewable" ON public.categories;
DROP POLICY IF EXISTS "Teachers and admins can insert categories" ON public.categories;
DROP POLICY IF EXISTS "Teachers and admins can update categories" ON public.categories;
DROP POLICY IF EXISTS "Teachers and admins can delete categories" ON public.categories;
DROP POLICY IF EXISTS "Categories view policy" ON public.categories;
DROP POLICY IF EXISTS "Categories insert policy" ON public.categories;
DROP POLICY IF EXISTS "Categories update policy" ON public.categories;
DROP POLICY IF EXISTS "Categories delete policy" ON public.categories;

CREATE POLICY "Categories view policy"
    ON public.categories FOR SELECT
    USING (is_active = TRUE OR public.is_teacher());

CREATE POLICY "Categories insert policy"
    ON public.categories FOR INSERT
    WITH CHECK (public.is_teacher());

CREATE POLICY "Categories update policy"
    ON public.categories FOR UPDATE
    USING (public.is_teacher())
    WITH CHECK (public.is_teacher());

CREATE POLICY "Categories delete policy"
    ON public.categories FOR DELETE
    USING (public.is_admin());

-- المواضيع الفرعية Topics
DROP POLICY IF EXISTS "Topics are publicly viewable" ON public.topics;
DROP POLICY IF EXISTS "Teachers and admins can manage topics" ON public.topics;
DROP POLICY IF EXISTS "Topics view policy" ON public.topics;
DROP POLICY IF EXISTS "Topics write policy" ON public.topics;

CREATE POLICY "Topics view policy"
    ON public.topics FOR SELECT
    USING (TRUE);

CREATE POLICY "Topics write policy"
    ON public.topics FOR ALL
    USING (public.is_teacher())
    WITH CHECK (public.is_teacher());

-- ------------------------------------------------------------------------------
-- ج. جدول Questions (بنك الأسئلة والشروحات الرياضية)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Published questions are viewable by all" ON public.questions;
DROP POLICY IF EXISTS "Teachers and admins can manage questions" ON public.questions;
DROP POLICY IF EXISTS "Teachers and admins can view all questions" ON public.questions;
DROP POLICY IF EXISTS "Questions select policy" ON public.questions;
DROP POLICY IF EXISTS "Questions insert policy" ON public.questions;
DROP POLICY IF EXISTS "Questions update policy" ON public.questions;
DROP POLICY IF EXISTS "Questions delete policy" ON public.questions;

-- القراءة: الطالب يرى الأسئلة المنشورة فقط، بينما المعلم والمدير يريان المسودات والكل
CREATE POLICY "Questions select policy"
    ON public.questions FOR SELECT
    USING (is_published = TRUE OR public.is_teacher());

-- الكتابة (إضافة، تعديل، حذف): مقتصرة تماماً على المعلمين والمدراء
CREATE POLICY "Questions insert policy"
    ON public.questions FOR INSERT
    WITH CHECK (public.is_teacher());

CREATE POLICY "Questions update policy"
    ON public.questions FOR UPDATE
    USING (public.is_teacher())
    WITH CHECK (public.is_teacher());

CREATE POLICY "Questions delete policy"
    ON public.questions FOR DELETE
    USING (public.is_teacher());

-- ------------------------------------------------------------------------------
-- د. جدولي Quizzes & Quiz Questions (قوالب الاختبارات ومكوناتها)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Published quizzes are viewable by all" ON public.quizzes;
DROP POLICY IF EXISTS "Teachers and admins can manage quizzes" ON public.quizzes;
DROP POLICY IF EXISTS "Quiz questions are viewable by all" ON public.quiz_questions;
DROP POLICY IF EXISTS "Teachers and admins can manage quiz questions" ON public.quiz_questions;
DROP POLICY IF EXISTS "Quizzes select policy" ON public.quizzes;
DROP POLICY IF EXISTS "Quizzes write policy" ON public.quizzes;
DROP POLICY IF EXISTS "Quiz questions select policy" ON public.quiz_questions;
DROP POLICY IF EXISTS "Quiz questions write policy" ON public.quiz_questions;

CREATE POLICY "Quizzes select policy"
    ON public.quizzes FOR SELECT
    USING (is_published = TRUE OR public.is_teacher());

CREATE POLICY "Quizzes write policy"
    ON public.quizzes FOR ALL
    USING (public.is_teacher())
    WITH CHECK (public.is_teacher());

CREATE POLICY "Quiz questions select policy"
    ON public.quiz_questions FOR SELECT
    USING (TRUE);

CREATE POLICY "Quiz questions write policy"
    ON public.quiz_questions FOR ALL
    USING (public.is_teacher())
    WITH CHECK (public.is_teacher());

-- ------------------------------------------------------------------------------
-- هـ. جدول User Quiz Attempts (محاولات ونتائج الاختبارات - حماية منع التلاعب)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view their own quiz attempts" ON public.user_quiz_attempts;
DROP POLICY IF EXISTS "Users can insert their own quiz attempts" ON public.user_quiz_attempts;
DROP POLICY IF EXISTS "Attempts select policy" ON public.user_quiz_attempts;
DROP POLICY IF EXISTS "Attempts insert policy" ON public.user_quiz_attempts;
DROP POLICY IF EXISTS "Attempts update policy" ON public.user_quiz_attempts;
DROP POLICY IF EXISTS "Attempts delete policy" ON public.user_quiz_attempts;

-- القراءة: الطالب يرى محاولاته فقط، والمعلم والمدير يريان محاولات الطلاب للتقييم والتحليلات
CREATE POLICY "Attempts select policy"
    ON public.user_quiz_attempts FOR SELECT
    USING (
        auth.uid() = user_id 
        OR public.is_teacher()
    );

-- الإدخال: الطالب يدخل نتيجته الشخصية فقط
CREATE POLICY "Attempts insert policy"
    ON public.user_quiz_attempts FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- التعديل (UPDATE): ممنوع نهائياً على الطلاب والجميع (Anti-Cheat) لمنع تزوير النتائج والدرجات
CREATE POLICY "Attempts update policy"
    ON public.user_quiz_attempts FOR UPDATE
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- الحذف: مقتصر حصراً على المشرف العام (Admin) فقط لأغراض الصيانة
CREATE POLICY "Attempts delete policy"
    ON public.user_quiz_attempts FOR DELETE
    USING (public.is_admin());

-- ------------------------------------------------------------------------------
-- و. جدول Saved Questions (الأسئلة المحفوظة للمراجعة)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view their saved questions" ON public.saved_questions;
DROP POLICY IF EXISTS "Users can save questions" ON public.saved_questions;
DROP POLICY IF EXISTS "Users can remove saved questions" ON public.saved_questions;
DROP POLICY IF EXISTS "Users can update their notes on saved questions" ON public.saved_questions;
DROP POLICY IF EXISTS "Saved questions policy" ON public.saved_questions;

CREATE POLICY "Saved questions policy"
    ON public.saved_questions FOR ALL
    USING (auth.uid() = user_id OR public.is_admin())
    WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- ------------------------------------------------------------------------------
-- ز. سياسات مستودع التخزين Storage (Question Images)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public access to question images" ON storage.objects;
DROP POLICY IF EXISTS "Teachers and admins can upload question images" ON storage.objects;
DROP POLICY IF EXISTS "Teachers and admins can modify question images" ON storage.objects;
DROP POLICY IF EXISTS "Teachers and admins can delete question images" ON storage.objects;

-- القراءة عامة للجميع
CREATE POLICY "Public access to question images"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'question-images');

-- الرفع والتعديل والحذف للمعلمين والمدراء فقط
CREATE POLICY "Teachers and admins can upload question images"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'question-images' 
        AND public.is_teacher()
    );

CREATE POLICY "Teachers and admins can modify question images"
    ON storage.objects FOR UPDATE
    USING (
        bucket_id = 'question-images' 
        AND public.is_teacher()
    );

CREATE POLICY "Teachers and admins can delete question images"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'question-images' 
        AND public.is_teacher()
    );

-- ==============================================================================
-- 6. دالة مساعدة لترقية مستخدم إلى مدير أو معلم (Admin Helper Procedure)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.set_user_role(
    target_user_id UUID,
    new_role public.user_role
)
RETURNS void AS $$
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'غير مصرح: يجب أن تكون مديراً لتغيير أدوار المستخدمين.';
    END IF;

    UPDATE public.profiles
    SET role = new_role
    WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;
