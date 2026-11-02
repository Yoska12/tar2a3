-- ==============================================================================
-- منصة طرقع للقدرات - تفعيل نظام النقاط في قاعدة البيانات (Supabase Database Migration)
-- ==============================================================================
-- حل مشكلة حفظ النقاط في الجهاز/الكوكيز:
-- نقل النقاط بالكامل إلى قاعدة البيانات المركزية وربطها بحساب الطالب

-- 1. إضافة عمود النقاط وسجل المعاملات لجدول ملفات المستخدمين (public.profiles)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS points INT DEFAULT 0 CHECK (points >= 0);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS points_history JSONB DEFAULT '[]'::jsonb;

-- 2. إنشاء فهرس ترتيبي لتسريع الاستعلام عن قائمة المتصدرين (Leaderboard Query Optimization)
CREATE INDEX IF NOT EXISTS idx_profiles_points ON public.profiles(points DESC);

-- 3. تحديث دالة وتريجر تسجيل المستخدمين الجدد (handle_new_user)
-- لضمان تعيين 0 نقاط مبدئياً لأي طالب جديد
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (
    id, 
    email, 
    full_name, 
    role, 
    target_score, 
    points,
    points_history,
    telegram_username, 
    telegram_id,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      CASE WHEN LOWER(TRIM(NEW.email)) = 'yassooooo27m@gmail.com' THEN 'Yoska' ELSE NULL END,
      NEW.raw_user_meta_data->>'full_name', 
      split_part(NEW.email, '@', 1),
      'طالب طرقع'
    ),
    CASE 
      WHEN LOWER(TRIM(NEW.email)) = 'yassooooo27m@gmail.com' THEN 'super_admin'::public.user_role
      ELSE COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role, 'student'::public.user_role)
    END,
    COALESCE(
      CASE 
        WHEN (NEW.raw_user_meta_data->>'target_score') ~ '^[0-9]+$' 
        THEN (NEW.raw_user_meta_data->>'target_score')::int 
        ELSE 100 
      END, 
      100
    ),
    0,
    '[]'::jsonb,
    NEW.raw_user_meta_data->>'telegram_username',
    CASE 
      WHEN (NEW.raw_user_meta_data->>'telegram_id') ~ '^[0-9]+$' 
      THEN (NEW.raw_user_meta_data->>'telegram_id')::bigint 
      ELSE NULL 
    END,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    telegram_username = COALESCE(EXCLUDED.telegram_username, profiles.telegram_username),
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;
