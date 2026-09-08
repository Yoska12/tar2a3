-- ==============================================================================
-- 🚀 منصة طرقع للكمي (Tarqa'a Qudurat Platform) - سكربت قاعدة البيانات الشامل
-- متوافق 100% مع Supabase PostgreSQL 15+ و Row Level Security (RLS)
-- ==============================================================================

-- تفعيل الامتدادات الضرورية (إذا لم تكن مفعلة)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 1. إنشاء الأنواع المخصصة (Custom ENUM Types)
-- ==============================================================================

DO $$ BEGIN
    CREATE TYPE public.user_role AS ENUM ('student', 'teacher', 'admin', 'super_admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.question_difficulty AS ENUM ('Easy', 'Medium', 'Hard');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.quiz_type AS ENUM ('Diagnostic', 'Topic_Practice', 'Full_Mock', 'Speed_Challenge');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.option_key AS ENUM ('A', 'B', 'C', 'D');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ==============================================================================
-- 2. دالة تحديث التوقيت التلقائي (Updated At Trigger Function)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- 3. إنشاء الجداول الرئيسية (Tables)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- جدول 1: ملفات المستخدمين والطلاب (Profiles)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL DEFAULT 'طالب طرقع',
    avatar_url TEXT,
    target_score INT DEFAULT 100 CHECK (target_score BETWEEN 50 AND 100),
    role public.user_role NOT NULL DEFAULT 'student',
    phone_number TEXT,
    streak_days INT DEFAULT 0,
    telegram_id BIGINT UNIQUE,
    telegram_username TEXT,
    telegram_chat_id BIGINT,
    telegram_linked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ------------------------------------------------------------------------------
-- جدول 2: أقسام الكمي الرئيسية (Categories)
-- (الجبر، الهندسة، الحساب، المقارنات، الإحصاء والاحتمالات، المسائل اللفظية)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    icon TEXT,
    order_index INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ------------------------------------------------------------------------------
-- جدول 3: الموضوعات الفرعية داخل كل قسم (Topics)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.topics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    order_index INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ------------------------------------------------------------------------------
-- جدول 4: بنك الأسئلة الرياضية (Questions)
-- يدعم KaTeX / LaTeX، الرسوم البيانية، خيارات JSONB، وشرح "طريقة طرقع"
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE RESTRICT,
    topic_id UUID REFERENCES public.topics(id) ON DELETE SET NULL,
    question_text TEXT NOT NULL, -- يدعم نصوص KaTeX مثل $2^{x+1} = 8$
    question_image_url TEXT,     -- رابط الصورة في Supabase Storage
    svg_diagram TEXT,            -- كود SVG اختياري للرسوم الهندسية عالية الدقة
    options JSONB NOT NULL,      -- مصفوفة الخيارات: [{"id": "A", "text": "..."}, ...]
    correct_option public.option_key NOT NULL,
    explanation TEXT NOT NULL,   -- شرح "طريقة طرقع الذكية" للحل السريع
    explanation_image_url TEXT,
    difficulty public.question_difficulty DEFAULT 'Medium' NOT NULL,
    source TEXT DEFAULT 'تجميعات حديثة',
    is_published BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ------------------------------------------------------------------------------
-- جدول 5: الاختبارات وقوالب التحدي (Quizzes)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.quizzes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    type public.quiz_type NOT NULL DEFAULT 'Full_Mock',
    duration_minutes INT NOT NULL DEFAULT 20 CHECK (duration_minutes > 0),
    is_published BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ------------------------------------------------------------------------------
-- جدول 6: جدول ربط الأسئلة بالاختبارات وترتيبها (Quiz Questions)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.quiz_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
    order_index INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    CONSTRAINT uq_quiz_question UNIQUE (quiz_id, question_id)
);

-- ------------------------------------------------------------------------------
-- جدول 7: جلسات ومحاولات الاختبار للطلاب (User Quiz Attempts)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_quiz_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
    score NUMERIC(5,2) DEFAULT 0.00 NOT NULL,
    total_questions INT NOT NULL DEFAULT 0,
    correct_count INT NOT NULL DEFAULT 0,
    wrong_count INT NOT NULL DEFAULT 0,
    time_spent_seconds INT NOT NULL DEFAULT 0,
    answers JSONB DEFAULT '{}'::jsonb NOT NULL, -- سجل الإجابات وزمن كل سؤال
    completed_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ------------------------------------------------------------------------------
-- جدول 8: الأسئلة المحفوظة للمراجعة لاحقاً (Saved Questions / Bookmarks)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.saved_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
    notes TEXT, -- ملاحظات الطالب الشخصية على السؤال
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    CONSTRAINT uq_user_saved_question UNIQUE (user_id, question_id)
);

-- ==============================================================================
-- 4. إعداد الفهارس عالية الأداء (Performance Indexes)
-- ==============================================================================

-- فهارس جدول المواضيع
CREATE INDEX IF NOT EXISTS idx_topics_category_id ON public.topics(category_id);

-- فهارس جدول الأسئلة (لتسريع الفلترة والبحث أثناء سحب الأسئلة)
CREATE INDEX IF NOT EXISTS idx_questions_category_id ON public.questions(category_id);
CREATE INDEX IF NOT EXISTS idx_questions_topic_id ON public.questions(topic_id);
CREATE INDEX IF NOT EXISTS idx_questions_difficulty ON public.questions(difficulty);
CREATE INDEX IF NOT EXISTS idx_questions_is_published ON public.questions(is_published);
CREATE INDEX IF NOT EXISTS idx_questions_created_at ON public.questions(created_at DESC);

-- فهارس جدول ربط أسئلة الاختبار
CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz_id ON public.quiz_questions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_order ON public.quiz_questions(quiz_id, order_index);

-- فهارس جدول محاولات الطلاب
CREATE INDEX IF NOT EXISTS idx_attempts_user_id ON public.user_quiz_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_attempts_quiz_id ON public.user_quiz_attempts(quiz_id);
CREATE INDEX IF NOT EXISTS idx_attempts_completed_at ON public.user_quiz_attempts(completed_at DESC);

-- فهارس جدول الأسئلة المحفوظة وملف التليجرام
CREATE INDEX IF NOT EXISTS idx_saved_questions_user_id ON public.saved_questions(user_id);
-- فهارس جدول الأسئلة المحفوظة وملف التليجرام
CREATE INDEX IF NOT EXISTS idx_saved_questions_user_id ON public.saved_questions(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_questions_created_at ON public.saved_questions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_telegram_id ON public.profiles(telegram_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- ==============================================================================
-- 5. الدوال الأمنية المساعدة للتحقق من الصلاحيات (Security Definer Functions)
-- ==============================================================================

-- أ. جلب دور المستخدم الحالي من الـ JWT أولاً ثم من جدول profiles كإجراء احتياطي
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS public.user_role AS $$
DECLARE
    v_role public.user_role;
    v_jwt_role text;
BEGIN
    v_jwt_role := (auth.jwt() -> 'app_metadata' ->> 'role');
    IF v_jwt_role IS NOT NULL THEN
        RETURN v_jwt_role::public.user_role;
    END IF;

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
        RETURN true;
    END IF;
    RETURN (public.get_current_user_role() = required_role);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth;

-- ==============================================================================
-- 6. التريجرز (Triggers) وحماية تصعيد الصلاحيات ومزامنة الـ JWT
-- ==============================================================================

-- منع تصعيد الصلاحيات (Privilege Escalation Guard)
CREATE OR REPLACE FUNCTION public.prevent_unauthorized_role_change()
RETURNS TRIGGER AS $$
BEGIN
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

-- مزامنة الدور تلقائياً إلى raw_app_meta_data في auth.users
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

-- تريجر إنشاء ملف المستخدم تلقائياً عند التسجيل في Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_initial_role public.user_role := 'student';
BEGIN
    IF NEW.email = 'yassooooo27m@gmail.com' THEN
        v_initial_role := 'super_admin';
    ELSIF NEW.raw_app_meta_data->>'role' IS NOT NULL THEN
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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- تريجرز التحديث التلقائي لعمود updated_at
DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_questions_updated_at ON public.questions;
CREATE TRIGGER set_questions_updated_at
    BEFORE UPDATE ON public.questions
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_quizzes_updated_at ON public.quizzes;
CREATE TRIGGER set_quizzes_updated_at
    BEFORE UPDATE ON public.quizzes
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ==============================================================================
-- 7. سياسات أمان مستوى الصف المتقدمة (Row Level Security - RLS)
-- ==============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_questions ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
DROP POLICY IF EXISTS "Profiles view policy" ON public.profiles;
DROP POLICY IF EXISTS "Profiles update policy" ON public.profiles;
DROP POLICY IF EXISTS "Profiles delete policy" ON public.profiles;

CREATE POLICY "Profiles view policy"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id OR public.is_teacher());

CREATE POLICY "Profiles update policy"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id OR public.is_admin())
    WITH CHECK (auth.uid() = id OR public.is_admin());

CREATE POLICY "Profiles delete policy"
    ON public.profiles FOR DELETE
    USING (public.is_admin());

-- Categories & Topics Policies
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

DROP POLICY IF EXISTS "Topics view policy" ON public.topics;
DROP POLICY IF EXISTS "Topics write policy" ON public.topics;

CREATE POLICY "Topics view policy"
    ON public.topics FOR SELECT
    USING (TRUE);

CREATE POLICY "Topics write policy"
    ON public.topics FOR ALL
    USING (public.is_teacher())
    WITH CHECK (public.is_teacher());

-- Questions Policies
DROP POLICY IF EXISTS "Questions select policy" ON public.questions;
DROP POLICY IF EXISTS "Questions insert policy" ON public.questions;
DROP POLICY IF EXISTS "Questions update policy" ON public.questions;
DROP POLICY IF EXISTS "Questions delete policy" ON public.questions;

CREATE POLICY "Questions select policy"
    ON public.questions FOR SELECT
    USING (is_published = TRUE OR public.is_teacher());

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

-- Quizzes & Quiz Questions Policies
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

-- User Quiz Attempts Policies (Anti-Tampering)
DROP POLICY IF EXISTS "Attempts select policy" ON public.user_quiz_attempts;
DROP POLICY IF EXISTS "Attempts insert policy" ON public.user_quiz_attempts;
DROP POLICY IF EXISTS "Attempts update policy" ON public.user_quiz_attempts;
DROP POLICY IF EXISTS "Attempts delete policy" ON public.user_quiz_attempts;

CREATE POLICY "Attempts select policy"
    ON public.user_quiz_attempts FOR SELECT
    USING (auth.uid() = user_id OR public.is_teacher());

CREATE POLICY "Attempts insert policy"
    ON public.user_quiz_attempts FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Attempts update policy"
    ON public.user_quiz_attempts FOR UPDATE
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

CREATE POLICY "Attempts delete policy"
    ON public.user_quiz_attempts FOR DELETE
    USING (public.is_admin());

-- Saved Questions Policies
DROP POLICY IF EXISTS "Saved questions policy" ON public.saved_questions;

CREATE POLICY "Saved questions policy"
    ON public.saved_questions FOR ALL
    USING (auth.uid() = user_id OR public.is_admin())
    WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- Storage Bucket Policies (question-images)
INSERT INTO storage.buckets (id, name, public)
VALUES ('question-images', 'question-images', TRUE)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public access to question images" ON storage.objects;
DROP POLICY IF EXISTS "Teachers and admins can upload question images" ON storage.objects;
DROP POLICY IF EXISTS "Teachers and admins can modify question images" ON storage.objects;
DROP POLICY IF EXISTS "Teachers and admins can delete question images" ON storage.objects;

CREATE POLICY "Public access to question images"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'question-images');

CREATE POLICY "Teachers and admins can upload question images"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'question-images' AND public.is_teacher());

CREATE POLICY "Teachers and admins can modify question images"
    ON storage.objects FOR UPDATE
    USING (bucket_id = 'question-images' AND public.is_teacher());

CREATE POLICY "Teachers and admins can delete question images"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'question-images' AND public.is_teacher());

-- ==============================================================================
-- 8. بيانات البداية الأولية (Seed Data) - أقسام وأسئلة كمي نموذجية
-- ==============================================================================

-- 1. إضافة الأقسام الستة
INSERT INTO public.categories (id, title, slug, description, icon, order_index) VALUES
('11111111-1111-1111-1111-111111111111', 'الجبر والمعادلات', 'algebra', 'الأسس، الجذور، المتطابقات، المتتابعات، وحل المعادلات', 'Variable', 1),
('22222222-2222-2222-2222-222222222222', 'الهندسة والقياس', 'geometry', 'المثلثات، الدوائر، الزوايا، المساحات والمحيطات، وفيثاغورس', 'Shapes', 2),
('33333333-3333-3333-3333-333333333333', 'الحساب والأعداد', 'arithmetic', 'النسب المئوية، التدرج المنتظم، الكسور، والعمليات الذهنية', 'Calculator', 3),
('44444444-4444-4444-4444-444444444444', 'المقارنات', 'comparisons', 'مقارنة بين قيمتين (الأولى أكبر، الثانية أكبر، متساويتان، المعطيات غير كافية)', 'Scale', 4),
('55555555-5555-5555-5555-555555555555', 'الإحصاء والاحتمالات', 'statistics', 'المتوسط الحسابي، الوسيط، الرسوم البيانية، والاحتمالات', 'BarChart3', 5),
('66666666-6666-6666-6666-666666666666', 'المسائل اللفظية', 'word-problems', 'السرعة والمسافة، الأعمار، والعمل المشترك والصنابير', 'Clock', 6)
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title;

-- 2. إضافة موضوعات فرعية
INSERT INTO public.topics (id, category_id, title) VALUES
('a1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'المعادلات الأسية والجذور'),
('b2222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'المثلثات ونظرية فيثاغورس'),
('c3333333-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333', 'النسب المئوية والتدرج المنتظم')
ON CONFLICT (id) DO NOTHING;

-- 3. إضافة أسئلة قدرات واقعية مع KaTeX وشروحات طرقع
INSERT INTO public.questions (id, category_id, topic_id, question_text, options, correct_option, explanation, difficulty) VALUES
(
    'e1111111-1111-1111-1111-111111111111',
    '11111111-1111-1111-1111-111111111111',
    'a1111111-1111-1111-1111-111111111111',
    'إذا كان $2^{x+1} = 8$ ، فما هي قيمة $x$ ؟',
    '[
        {"id": "A", "text": "$1$"},
        {"id": "B", "text": "$2$"},
        {"id": "C", "text": "$3$"},
        {"id": "D", "text": "$4$"}
    ]'::jsonb,
    'B',
    '🎯 **طريقة طرقع السريعة:**\nوحّد الأساسات فوراً! الـ $8 = 2^3$.\nإذن: $2^{x+1} = 2^3 \implies x + 1 = 3 \implies x = 2$.\nطرقعها ذهنياً في ثانيتين!',
    'Easy'
),
(
    'e2222222-2222-2222-2222-222222222222',
    '33333333-3333-3333-3333-333333333333',
    'c3333333-3333-3333-3333-333333333333',
    'اشترى أحمد سلعة بمبلغ $60$ ريالاً بعد تخفيض بنسبة $25\%$ ، كم كان سعرها الأصلي قبل التخفيض؟',
    '[
        {"id": "A", "text": "$75$ ريالاً"},
        {"id": "B", "text": "$80$ ريالاً"},
        {"id": "C", "text": "$85$ ريالاً"},
        {"id": "D", "text": "$90$ ريالاً"}
    ]'::jsonb,
    'B',
    '⚡ **طريقة طرقع (التدرج المنتظم):**\nالسلعة بعد خصم $25\%$ تبقى منها $75\% = \frac{3}{4}$ من السعر.\nإذا كانت الـ $3$ أجزاء = $60$ ريالاً، فإن الجزء الواحد = $20$ ريالاً.\nالسعر الأصلي ($4$ أجزاء) = $4 \times 20 = 80$ ريالاً.',
    'Medium'
),
(
    'e3333333-3333-3333-3333-333333333333',
    '44444444-4444-4444-4444-444444444444',
    NULL,
    'قارن بين:\n**القيمة الأولى:** $\sqrt{49} + \sqrt{36}$\n**القيمة الثانية:** $\sqrt{49 + 36}$',
    '[
        {"id": "A", "text": "القيمة الأولى أكبر"},
        {"id": "B", "text": "القيمة الثانية أكبر"},
        {"id": "C", "text": "القيمتان متساويتان"},
        {"id": "D", "text": "المعطيات غير كافية"}
    ]'::jsonb,
    'A',
    '💡 **قاعدة طرقع الذهبية في الجذور:**\nتوزيع الجذور على الجمع دائماً أكبر من جمع المقدار تحت جذر واحد!\n$\sqrt{49} + \sqrt{36} = 7 + 6 = 13$\nبينما $\sqrt{49+36} = \sqrt{85} \approx 9.2$\nإذن القيمة الأولى أكبر بمجرد النظر دون حساب!',
    'Easy'
)
ON CONFLICT (id) DO NOTHING;

-- 4. إضافة اختبار محاكي تجريبي
INSERT INTO public.quizzes (id, title, description, type, duration_minutes) VALUES
(
    'f1111111-1111-1111-1111-111111111111',
    'اختبار محاكي قياس الكمي الشامل',
    'اختبار تجريبي شامل يحاكي معايير وأقسام المركز الوطني للقياس لاختبار القدرات العامة',
    'Full_Mock',
    25
)
ON CONFLICT (id) DO NOTHING;

-- ربط الأسئلة بالاختبار
INSERT INTO public.quiz_questions (quiz_id, question_id, order_index) VALUES
('f1111111-1111-1111-1111-111111111111', 'e1111111-1111-1111-1111-111111111111', 1),
('f1111111-1111-1111-1111-111111111111', 'e2222222-2222-2222-2222-222222222222', 2),
('f1111111-1111-1111-1111-111111111111', 'e3333333-3333-3333-3333-333333333333', 3)
ON CONFLICT (quiz_id, question_id) DO NOTHING;
