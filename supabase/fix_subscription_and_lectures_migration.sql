-- ==============================================================================
-- منصة طرقع - سكريبت ترقية وتثبيت تفعيل وإلغاء الاشتراكات والمحاضرات السحابية
-- Tarqa Platform - Subscription & Cloud Lectures Sync Fix
-- ==============================================================================

-- 1. التأكد من وجود أعمدة الاشتراك في جدول profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_subscribed BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ DEFAULT NULL;

-- 2. فهرس لتسريع الاستعلام عن المشتركين
CREATE INDEX IF NOT EXISTS idx_profiles_is_subscribed ON public.profiles(is_subscribed);

-- 3. دالة تفعيل ومنح الاشتراك السنوي للطلاب (Security Definer RPC)
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
    v_expires_at := now() + (days_count || ' days')::interval;

    -- محاولة التحديث بالـ UUID أولاً
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

    -- إذا لم يتم تحديث صف، نحدث بالبريد الإلكتروني
    IF v_rows_updated = 0 AND target_email IS NOT NULL AND TRIM(target_email) <> '' THEN
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

-- نسخة توافق بمعرف UUID
CREATE OR REPLACE FUNCTION public.admin_grant_subscription(
    target_user_id uuid,
    days_count integer DEFAULT 365
)
RETURNS jsonb AS $$
BEGIN
    RETURN public.admin_grant_subscription(target_user_id::text, days_count, NULL);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- 4. دالة إلغاء الاشتراك للطلاب (Security Definer RPC)
CREATE OR REPLACE FUNCTION public.admin_cancel_subscription(
    target_user_id text,
    target_email text DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
    v_target_uuid uuid;
    v_rows_updated integer := 0;
BEGIN
    -- محاولة التحديث بالـ UUID أولاً
    IF target_user_id IS NOT NULL AND target_user_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        v_target_uuid := target_user_id::uuid;
        UPDATE public.profiles
        SET 
            is_subscribed = false,
            subscription_expires_at = NULL,
            updated_at = now()
        WHERE id = v_target_uuid;
        GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
    END IF;

    -- إذا لم يتم تحديث صف، نحدث بالبريد الإلكتروني
    IF v_rows_updated = 0 AND target_email IS NOT NULL AND TRIM(target_email) <> '' THEN
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

-- منح الصلاحيات
GRANT EXECUTE ON FUNCTION public.admin_grant_subscription(text, integer, text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.admin_grant_subscription(uuid, integer) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.admin_cancel_subscription(text, text) TO authenticated, anon;

-- 5. إنشاء وتحديث حساب مخزن المحاضرات السحابي لضمان توفر كافة المحاضرات الـ 8 والملفات
INSERT INTO public.profiles (
    id,
    email,
    full_name,
    role,
    is_banned,
    ban_reason
) VALUES (
    '32344334-a8b9-40c3-aeeb-9d55f4d160e4',
    'lectures_store@tarqa.app',
    'مخزن المحاضرات السحابي',
    'teacher',
    false,
    '{"version":2,"modules":[{"id":"mod-lectures","title":"المحاضرات","description":"محاضرات التأسيس الشاملة للقدرات من الصفر حتى الاحتراف مع استراتيجيات وطرق الحل السريع في ثوانٍ.","orderIndex":1,"icon":"Video","badgeColor":"amber","isPublished":true,"status":"paused","customStatusText":"الاشتراك متاح قريباً ⏳","availableDate":"","totalDurationMinutes":185,"completedLessonsCount":2,"lessons":[{"id":"les-1","moduleId":"mod-lectures","moduleTitle":"المحاضرات","title":"المحاضرة 1: أسرار جدول الضرب والحساب الذهني الخاطف","description":"تقنيات تجزئة الأعداد والضرب السريع ذهنياً بدون قلم وورقة في ثانيتين فقط مع تدريبات قياس.","videoProvider":"uploaded_video","videoUrl":"https://vjs.zencdn.net/v/oceans.mp4","durationMinutes":18,"orderIndex":1,"isFreePreview":true,"isPublished":true,"isCompleted":true,"quizId":"f1111111-1111-1111-1111-111111111111","attachments":[{"id":"att-1-1","lessonId":"les-1","title":"ملخص الحساب الذهني الخاطف.pdf","fileUrl":"https://tarqa.app/files/mental_math_secrets.pdf","fileSize":"2.8 MB","fileType":"pdf"}]},{"id":"les-2","moduleId":"mod-lectures","moduleTitle":"المحاضرات","title":"المحاضرة 2: الكسور وتوحيد المقامات بأسلوب الفراشة","description":"شرح طريقة الفراشة السحرية لجمع وطرح وضرب وقسمة الكسور والعمليات المركبة بدون تعقيد.","videoProvider":"uploaded_video","videoUrl":"https://vjs.zencdn.net/v/oceans.mp4","durationMinutes":22,"orderIndex":2,"isFreePreview":true,"isPublished":true,"isCompleted":false,"quizId":"f1111111-1111-1111-1111-111111111111"},{"id":"les-3","moduleId":"mod-lectures","moduleTitle":"المحاضرات","title":"المحاضرة 3: قواعد قابلية القسمة السريعة على الأعداد","description":"كيف تكتشف قابلية قسمة الأعداد الكبيرة بمجرد النظر لتسريع حل مسائل الخيارات.","videoProvider":"uploaded_video","videoUrl":"https://vjs.zencdn.net/v/oceans.mp4","durationMinutes":16,"orderIndex":3,"isFreePreview":false,"isPublished":true,"isCompleted":false},{"id":"les-4","moduleId":"mod-lectures","moduleTitle":"المحاضرات","title":"المحاضرة 4: التناسب الطردي والعكسي وقاعدة الضرب التبادلي","description":"حل مسائل العمال، البناء، وسرعة إنجاز المهام بقاعدة الضرب التبادلي الخاطفة في ثوانٍ.","videoProvider":"uploaded_video","videoUrl":"https://vjs.zencdn.net/v/oceans.mp4","durationMinutes":24,"orderIndex":4,"isFreePreview":false,"isPublished":true,"isCompleted":false},{"id":"les-5","moduleId":"mod-lectures","moduleTitle":"المحاضرات","title":"المحاضرة 5: النسب المئوية وتطبيقات الربح والخسارة والتخفيضات","description":"استخراج 10% و 5% و 1% ذهنياً والتعامل مع مسائل التخفيضات المتتالية وزيادة الراتب.","videoProvider":"uploaded_video","videoUrl":"https://vjs.zencdn.net/v/oceans.mp4","durationMinutes":20,"orderIndex":5,"isFreePreview":false,"isPublished":true,"isCompleted":false},{"id":"les-6","moduleId":"mod-lectures","moduleTitle":"المحاضرات","title":"المحاضرة 6: أساسيات الهندسة والزوايا والمثلثات الذهبية المشهورة","description":"مثلث فيثاغورس الشهير ومجموع زوايا المضلعات ومساحات الدائرة والمربعات المتداخلة.","videoProvider":"uploaded_video","videoUrl":"https://vjs.zencdn.net/v/oceans.mp4","durationMinutes":28,"orderIndex":6,"isFreePreview":false,"isPublished":true,"isCompleted":false},{"id":"les-7","moduleId":"mod-lectures","moduleTitle":"المحاضرات","title":"المحاضرة 7: الجبر والمعادلات والأسس والجذور بلمح البصر","description":"تبسيط الجذور الصعبة والتعامل مع الأسس السالبة والكسرية وطرق التعويض الذكي من الخيارات.","videoProvider":"uploaded_video","videoUrl":"https://vjs.zencdn.net/v/oceans.mp4","durationMinutes":26,"orderIndex":7,"isFreePreview":false,"isPublished":true,"isCompleted":false},{"id":"les-8","moduleId":"mod-lectures","moduleTitle":"المحاضرات","title":"المحاضرة 8: استراتيجيات قياس لحل أصعب المقارنات والإحصاء","description":"المتوسط الحسابي، الوسيط، المنوال، وحيل اختيار القيمة الأولى أو الثانية أو المعطيات غير كافية.","videoProvider":"uploaded_video","videoUrl":"https://vjs.zencdn.net/v/oceans.mp4","durationMinutes":31,"orderIndex":8,"isFreePreview":false,"isPublished":true,"isCompleted":false}]}],"files":[{"id":"file-1","title":"مذكرة طرقع الشاملة لتأسيس القدرات (الملف الكامل 2025)","description":"الحقيبة الشاملة لكافة قواعد التأسيس، القوانين الذهبية، وأكثر من 500 تمرين ومسألة محلولة بأحدث استراتيجيات طرقع الخاطفة.","fileUrl":"vault://pdf_tarqa_foundation_2025","fileSize":"14.8 MB","pagesCount":"185 صفحة","fileType":"pdf","isFreePreview":true,"downloadCount":1420,"uploadedAt":"1446/02/15"},{"id":"file-2","title":"كتيب القوانين الذهبية وطرق الحل السريع في ثوانٍ","description":"ملخص مركز وشامل لكافة قوانين الهندسة، الجبر، الحساب، والإحصاء بطريقة الحفظ البصري المبتكرة.","fileUrl":"vault://pdf_golden_rules_summary","fileSize":"3.4 MB","pagesCount":"42 صفحة","fileType":"summary","isFreePreview":false,"downloadCount":890,"uploadedAt":"1446/02/18"},{"id":"file-3","title":"أوراق العمل التطبيقية ومفاتيح الحل النموذجية","description":"تمارين تفاعلية بعد كل درس لاختبار استيعاب الطالب وسرعة الإجابة مع خطوات الحل النموذجية المفصلة.","fileUrl":"vault://pdf_practice_worksheets","fileSize":"6.1 MB","pagesCount":"78 صفحة","fileType":"worksheet","isFreePreview":false,"downloadCount":650,"uploadedAt":"1446/02/20"}],"updatedAt":"2026-09-12T23:00:00Z"}'
)
ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    ban_reason = EXCLUDED.ban_reason,
    updated_at = now();
