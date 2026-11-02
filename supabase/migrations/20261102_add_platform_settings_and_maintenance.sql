-- ==============================================================================
-- 🛠️ منصة طرقع - جدول إعدادات المنصة ووضع الصيانة المركزي (Database Platform Settings)
-- ==============================================================================
-- الغرض: ربط وضع الصيانة مباشرة بقاعدة البيانات ومنع اعتماده على الكوكيز أو التخزين المؤقت المحلي.

CREATE TABLE IF NOT EXISTS public.platform_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by TEXT
);

-- تفعيل أمان مستوى الصفوف (Row Level Security)
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- 1. السماح للجميع (الزوار، الطلاب، المدرسين، والمشرفين) بقراءة الإعدادات العامة مثل وضع الصيانة
DROP POLICY IF EXISTS "Allow public read platform_settings" ON public.platform_settings;
CREATE POLICY "Allow public read platform_settings" ON public.platform_settings
    FOR SELECT
    USING (true);

-- 2. حصر التعديل والإدخال والحذف فقط على المشرفين والإدارة ومفتاح الخدمة (Service Role)
DROP POLICY IF EXISTS "Allow admins manage platform_settings" ON public.platform_settings;
CREATE POLICY "Allow admins manage platform_settings" ON public.platform_settings
    FOR ALL
    USING (
        auth.role() = 'service_role' OR
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'super_admin')
        )
    );

-- 3. إدراج أو تحديث الحالة الافتراضية لوضع الصيانة (معطل افتراضياً لمنع الحجب العشوائي)
INSERT INTO public.platform_settings (key, value, updated_at)
VALUES (
    'maintenance',
    jsonb_build_object(
        'isEnabled', false,
        'title', 'المنصة تخضع حالياً لأعمال صيانة وتطوير دوري 🛠️',
        'message', 'يقوم فريق طرقع الآن بإجراء تحديثات وتحسينات شاملة على خوادم المنصة وبنك الأسئلة لضمان تقديم أفضل تجربة تعليمية فائقة السرعة. سنعود للعمل بكامل طاقتنا في أقرب وقت ممكن!',
        'estimatedReturnTime', 'اليوم خلال ساعتين',
        'supportUrl', 'https://t.me/tr23km',
        'supportButtonText', 'متابعة آخر التحديثات عبر تليجرام 💬',
        'allowAdminBypass', true,
        'reasonPreset', 'routine',
        'updatedAt', '2026-11-02T00:00:00.000Z'
    ),
    NOW()
)
ON CONFLICT (key) DO NOTHING;
