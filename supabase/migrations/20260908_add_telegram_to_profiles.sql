-- ==============================================================================
-- 🚀 Migration: Add Telegram Authentication and Notification fields to Profiles
-- ==============================================================================

-- 1. إضافة أعمدة التليجرام إلى جدول profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS telegram_id BIGINT UNIQUE,
ADD COLUMN IF NOT EXISTS telegram_username TEXT,
ADD COLUMN IF NOT EXISTS telegram_chat_id BIGINT;

-- 2. فهرس لتسريع البحث والتحقق من حسابات تليجرام
CREATE INDEX IF NOT EXISTS idx_profiles_telegram_id ON public.profiles(telegram_id);
CREATE INDEX IF NOT EXISTS idx_profiles_telegram_username ON public.profiles(telegram_username);

-- 3. تحديث تريجر التسجيل التلقائي ليشمل بيانات تليجرام الواردة من auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (
        id, 
        full_name, 
        avatar_url, 
        target_score,
        telegram_id,
        telegram_username,
        telegram_chat_id
    )
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', 'طالب طرقع'),
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
        COALESCE((NEW.raw_user_meta_data->>'target_score')::int, 95),
        (NEW.raw_user_meta_data->>'telegram_id')::bigint,
        NEW.raw_user_meta_data->>'telegram_username',
        (NEW.raw_user_meta_data->>'telegram_chat_id')::bigint
    )
    ON CONFLICT (id) DO UPDATE SET
        telegram_id = COALESCE(EXCLUDED.telegram_id, profiles.telegram_id),
        telegram_username = COALESCE(EXCLUDED.telegram_username, profiles.telegram_username),
        telegram_chat_id = COALESCE(EXCLUDED.telegram_chat_id, profiles.telegram_chat_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
