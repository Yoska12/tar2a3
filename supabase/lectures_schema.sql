-- ==============================================================================
-- 🚀 منصة طرقع لتأسيس الكمي - سكربت نظام المحاضرات والمذكرات التأسيسية
-- متوافق بالكامل مع Supabase PostgreSQL 15+ و Row Level Security (RLS)
-- ==============================================================================

-- 1. إنشاء الأنواع المخصصة (Custom Enums)
DO $$ BEGIN
    CREATE TYPE public.video_provider AS ENUM ('youtube', 'vimeo', 'bunny', 'direct_url');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.attachment_type AS ENUM ('pdf', 'summary', 'worksheet');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ==============================================================================
-- 2. إنشاء جداول نظام المحاضرات (Lectures & Modules Schema)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- جدول 1: الأبواب التأسيسية لمسار الكمي من الصفر (Modules)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.modules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    order_index INT NOT NULL DEFAULT 0,
    icon TEXT DEFAULT 'BookOpen',
    badge_color TEXT DEFAULT 'amber',
    is_published BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ------------------------------------------------------------------------------
-- جدول 2: المحاضرات والدروس المرئية (Lessons)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lessons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module_id UUID NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    video_provider public.video_provider NOT NULL DEFAULT 'youtube',
    video_url TEXT NOT NULL, -- رابط يوتيوب أو Vimeo أو Bunny أو رابط مباشر MP4
    duration_minutes INT NOT NULL DEFAULT 15 CHECK (duration_minutes > 0),
    order_index INT NOT NULL DEFAULT 0,
    is_free_preview BOOLEAN DEFAULT FALSE NOT NULL, -- إتاحة الدرس كمعاينة مجانية
    is_published BOOLEAN DEFAULT TRUE NOT NULL,
    quiz_id UUID REFERENCES public.quizzes(id) ON DELETE SET NULL, -- كويز تطبيقي مباشر للدرس
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ------------------------------------------------------------------------------
-- جدول 3: المذكرات والملازم المرفقة بالدرس (Lesson Attachments)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lesson_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    file_url TEXT NOT NULL, -- مسار الملف في Supabase Storage (lecture-files)
    file_size TEXT DEFAULT '1.5 MB',
    file_type public.attachment_type NOT NULL DEFAULT 'pdf',
    download_count INT DEFAULT 0 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ------------------------------------------------------------------------------
-- جدول 4: تقدم وإنجاز الطالب في المحاضرات (User Lesson Progress)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_lesson_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
    is_completed BOOLEAN DEFAULT FALSE NOT NULL,
    last_watched_seconds INT DEFAULT 0 NOT NULL,
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    CONSTRAINT uq_user_lesson UNIQUE (user_id, lesson_id)
);

-- ==============================================================================
-- 3. الفهارس والتريجرز (Performance Indexes & Triggers)
-- ==============================================================================

CREATE INDEX IF NOT EXISTS idx_modules_order ON public.modules(order_index);
CREATE INDEX IF NOT EXISTS idx_modules_is_published ON public.modules(is_published);

CREATE INDEX IF NOT EXISTS idx_lessons_module_id ON public.lessons(module_id);
CREATE INDEX IF NOT EXISTS idx_lessons_order ON public.lessons(module_id, order_index);
CREATE INDEX IF NOT EXISTS idx_lessons_is_published ON public.lessons(is_published);

CREATE INDEX IF NOT EXISTS idx_attachments_lesson_id ON public.lesson_attachments(lesson_id);

CREATE INDEX IF NOT EXISTS idx_progress_user_id ON public.user_lesson_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_progress_lesson_id ON public.user_lesson_progress(lesson_id);
CREATE INDEX IF NOT EXISTS idx_progress_is_completed ON public.user_lesson_progress(user_id, is_completed);

-- تريجرز التحديث التلقائي لعمود updated_at
DROP TRIGGER IF EXISTS set_modules_updated_at ON public.modules;
CREATE TRIGGER set_modules_updated_at
    BEFORE UPDATE ON public.modules
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_lessons_updated_at ON public.lessons;
CREATE TRIGGER set_lessons_updated_at
    BEFORE UPDATE ON public.lessons
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_progress_updated_at ON public.user_lesson_progress;
CREATE TRIGGER set_progress_updated_at
    BEFORE UPDATE ON public.user_lesson_progress
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ==============================================================================
-- 4. سياسات أمان مستوى الصف (Row Level Security - RLS)
-- ==============================================================================

ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_lesson_progress ENABLE ROW LEVEL SECURITY;

-- أ. سياسات الأبواب Modules
DROP POLICY IF EXISTS "Modules select policy" ON public.modules;
DROP POLICY IF EXISTS "Modules write policy" ON public.modules;

CREATE POLICY "Modules select policy"
    ON public.modules FOR SELECT
    USING (is_published = TRUE OR public.is_teacher());

CREATE POLICY "Modules write policy"
    ON public.modules FOR ALL
    USING (public.is_teacher())
    WITH CHECK (public.is_teacher());

-- ب. سياسات المحاضرات Lessons
DROP POLICY IF EXISTS "Lessons select policy" ON public.lessons;
DROP POLICY IF EXISTS "Lessons write policy" ON public.lessons;

CREATE POLICY "Lessons select policy"
    ON public.lessons FOR SELECT
    USING (is_published = TRUE OR public.is_teacher());

CREATE POLICY "Lessons write policy"
    ON public.lessons FOR ALL
    USING (public.is_teacher())
    WITH CHECK (public.is_teacher());

-- ج. سياسات المرفقات Lesson Attachments
DROP POLICY IF EXISTS "Attachments select policy" ON public.lesson_attachments;
DROP POLICY IF EXISTS "Attachments write policy" ON public.lesson_attachments;

CREATE POLICY "Attachments select policy"
    ON public.lesson_attachments FOR SELECT
    USING (TRUE);

CREATE POLICY "Attachments write policy"
    ON public.lesson_attachments FOR ALL
    USING (public.is_teacher())
    WITH CHECK (public.is_teacher());

-- د. سياسات تقدم الطالب User Lesson Progress
DROP POLICY IF EXISTS "Progress select policy" ON public.user_lesson_progress;
DROP POLICY IF EXISTS "Progress insert policy" ON public.user_lesson_progress;
DROP POLICY IF EXISTS "Progress update policy" ON public.user_lesson_progress;

CREATE POLICY "Progress select policy"
    ON public.user_lesson_progress FOR SELECT
    USING (auth.uid() = user_id OR public.is_teacher());

CREATE POLICY "Progress insert policy"
    ON public.user_lesson_progress FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Progress update policy"
    ON public.user_lesson_progress FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ==============================================================================
-- 5. إعداد مستودع تخزين المذكرات والملازم (lecture-files Bucket)
-- ==============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('lecture-files', 'lecture-files', TRUE)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public access to lecture files" ON storage.objects;
DROP POLICY IF EXISTS "Teachers can upload lecture files" ON storage.objects;
DROP POLICY IF EXISTS "Teachers can modify lecture files" ON storage.objects;
DROP POLICY IF EXISTS "Teachers can delete lecture files" ON storage.objects;

-- القراءة والتحميل متاح لجميع الطلاب والزوار
CREATE POLICY "Public access to lecture files"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'lecture-files');

-- الرفع والتعديل والحذف للمعلمين والمدراء فقط
CREATE POLICY "Teachers can upload lecture files"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'lecture-files' AND public.is_teacher());

CREATE POLICY "Teachers can modify lecture files"
    ON storage.objects FOR UPDATE
    USING (bucket_id = 'lecture-files' AND public.is_teacher());

CREATE POLICY "Teachers can delete lecture files"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'lecture-files' AND public.is_teacher());

-- ==============================================================================
-- 6. بيانات أولية لمسار التأسيس من الصفر حتى الاحتراف (Seed Data)
-- ==============================================================================

-- إضافة الأبواب التأسيسية
INSERT INTO public.modules (id, title, description, order_index, icon, badge_color) VALUES
('10000000-0000-0000-0000-000000000001', 'الباب 1: المهارات الصفرية والعمليات الذهنية', 'تأسيس جدول الضرب والجمع السريع وطرق توحيد المقامات والكسور الاعتيادية', 1, 'Sparkles', 'amber'),
('20000000-0000-0000-0000-000000000002', 'الباب 2: القوى والجذور والمتطابقات الشهيرة', 'قوانين الأسس السالبة والكسرية، تبسيط وإنطاق الجذور، وأسرار المتطابقات الجبرية', 2, 'Variable', 'blue'),
('30000000-0000-0000-0000-000000000003', 'الباب 3: النسب المئوية والتناسب والتدرج المنتظم', 'استراتيجيات طرقع في التدرج السريع وحساب الربح والخسارة والخصومات', 3, 'Percent', 'emerald'),
('40000000-0000-0000-0000-000000000004', 'الباب 4: الهندسة والزوايا والأشكال المركبة', 'المثلثات المشهورة، فيثاغورس الذهني، الزوايا المتحالفة، ومساحات ومحيطات الدائرة', 4, 'Shapes', 'purple'),
('50000000-0000-0000-0000-000000000005', 'الباب 5: السرعة والمسافة والمسائل اللفظية', 'قوانين السرعة المتوسطة وزمن اللحاق، مسائل الأعمار، والعمل المشترك والصنابير', 5, 'Clock', 'rose')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title;

-- إضافة محاضرات الباب الأول (المهارات الصفرية)
INSERT INTO public.lessons (id, module_id, title, description, video_provider, video_url, duration_minutes, order_index, is_free_preview) VALUES
('11000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'أسرار جدول الضرب والعمليات الذهنية الخاطفة', 'كيف تضرب وتجمع أعداداً كبيرة بدون قلم وورقة في ثانيتين عبر تجزئة الأعداد', 'youtube', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 18, 1, TRUE),
('11000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'الكسور وتوحيد المقامات بأسلوب الفراشة', 'شرح طريقة الفراشة السريعة لجمع وطرح وضرب وقسمة الكسور دون تعقيد', 'youtube', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 22, 2, TRUE),
('11000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'قابلية القسمة على (2، 3، 4، 5، 6، 9)', 'قواعد ذهبية لتحديد قابلية قسمة الأعداد الكبيرة فورياً دون إجراء القسمة المطولة', 'youtube', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 16, 3, FALSE)
ON CONFLICT (id) DO NOTHING;

-- إضافة مذكرات PDF مرفقة
INSERT INTO public.lesson_attachments (id, lesson_id, title, file_url, file_size, file_type) VALUES
('11100000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', 'مذكرة طرقع - ملخص الحساب الذهني وجدول الضرب.pdf', 'https://tarqa.app/files/mental_math_summary.pdf', '2.4 MB', 'pdf'),
('11100000-0000-0000-0000-000000000002', '11000000-0000-0000-0000-000000000001', 'ورقة عمل تدريبية - 30 تمرين حساب ذهني خاطف.pdf', 'https://tarqa.app/files/mental_math_worksheet.pdf', '1.1 MB', 'worksheet'),
('11100000-0000-0000-0000-000000000003', '11000000-0000-0000-0000-000000000002', 'خريطة المفاهيم - قواعد الكسور وطريقة الفراشة.pdf', 'https://tarqa.app/files/fractions_map.pdf', '1.8 MB', 'summary')
ON CONFLICT (id) DO NOTHING;
