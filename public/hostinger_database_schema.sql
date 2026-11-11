-- ==============================================================================
-- 🚀 منصة طرقع (Tarqa Platform) - سكربت قاعدة بيانات هوستينجر الكامل (MySQL / MariaDB)
-- المتوافق بنسبة 100% مع phpMyAdmin واستضافة Hostinger (بدون Supabase نهائياً)
-- قاعدة البيانات: u187359406_tarqa
-- الترميز: utf8mb4_unicode_ci
-- ==============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ------------------------------------------------------------------------------
-- 1. جدول الأدوار (roles)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `roles` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(50) NOT NULL UNIQUE,
  `display_name` VARCHAR(100) NOT NULL,
  `description` VARCHAR(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `roles` (`id`, `name`, `display_name`, `description`) VALUES
(1, 'super_admin', 'سوبر أدمن', 'صلاحيات كاملة وغير محدودة للمنصة'),
(2, 'admin', 'مسؤول المنصة', 'إدارة المستخدمين والاشتراكات والمحتوى'),
(3, 'manager', 'مدير', 'إشراف على الطلاب والنتائج والمحاضرات'),
(4, 'teacher', 'معلم معتمد', 'إضافة وتعديل الدورات والمحاضرات والأسئلة'),
(5, 'subscribed', 'مشترك مدفوع', 'وصول كامل لكافة المحاضرات والميزات المدفوعة'),
(6, 'student', 'طالب طرقع', 'حساب طالب افتراضي مجاني')
ON DUPLICATE KEY UPDATE `display_name` = VALUES(`display_name`);

-- ------------------------------------------------------------------------------
-- 2. جدول الصلاحيات (permissions)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `permissions` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL UNIQUE,
  `description` VARCHAR(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `permissions` (`id`, `name`, `description`) VALUES
(1, 'access_admin', 'الدخول للوحة الإدارة'),
(2, 'edit_users', 'تعديل بيانات المستخدمين والرتب'),
(3, 'manage_courses', 'إدارة وتعديل المحاضرات والكورسات'),
(4, 'manage_subscriptions', 'تفعيل وإلغاء الاشتراكات'),
(5, 'view_results', 'مشاهدة نتائج المحاكيات والاختبارات'),
(6, 'manage_settings', 'إدارة إعدادات المنصة والصيانة')
ON DUPLICATE KEY UPDATE `description` = VALUES(`description`);

-- ------------------------------------------------------------------------------
-- 3. جدول ربط الأدوار بالصلاحيات (role_permission)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `role_permission` (
  `role_id` INT NOT NULL,
  `permission_id` INT NOT NULL,
  PRIMARY KEY (`role_id`, `permission_id`),
  FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`permission_id`) REFERENCES `permissions`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO `role_permission` (`role_id`, `permission_id`) VALUES
(1, 1), (1, 2), (1, 3), (1, 4), (1, 5), (1, 6),
(2, 1), (2, 2), (2, 3), (2, 4), (2, 5),
(3, 1), (3, 3), (3, 5),
(4, 3), (4, 5);

-- ------------------------------------------------------------------------------
-- 4. جدول المستخدمين والملفات الشخصية (users)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `users` (
  `id` VARCHAR(64) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `password_hash` VARCHAR(255) DEFAULT NULL,
  `first_name` VARCHAR(100) DEFAULT '',
  `last_name` VARCHAR(100) DEFAULT '',
  `full_name` VARCHAR(255) NOT NULL DEFAULT 'طالب طرقع',
  `role` ENUM('student', 'teacher', 'admin', 'super_admin') NOT NULL DEFAULT 'student',
  `role_id` INT NOT NULL DEFAULT 6,
  `target_score` INT NOT NULL DEFAULT 100,
  `telegram_id` BIGINT UNIQUE DEFAULT NULL,
  `telegram_username` VARCHAR(100) DEFAULT NULL,
  `profile_picture` TEXT DEFAULT NULL,
  `avatar_url` TEXT DEFAULT NULL,
  `phone` VARCHAR(50) DEFAULT NULL,
  `gender` VARCHAR(20) DEFAULT NULL,
  `is_subscribed` TINYINT(1) NOT NULL DEFAULT 0,
  `subscription_expires_at` DATETIME DEFAULT NULL,
  `subscription_period` VARCHAR(50) DEFAULT 'none',
  `is_banned` TINYINT(1) NOT NULL DEFAULT 0,
  `ban_reason` TEXT DEFAULT NULL,
  `points` INT NOT NULL DEFAULT 0,
  `login_count` INT NOT NULL DEFAULT 1,
  `force_logout` TINYINT(1) NOT NULL DEFAULT 0,
  `auth_date` VARCHAR(50) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_email` (`email`),
  KEY `idx_telegram_id` (`telegram_id`),
  KEY `idx_role` (`role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- إدراج حساب السوبر أدمن الافتراضي (Yoska)
INSERT INTO `users` (
  `id`, `email`, `full_name`, `role`, `role_id`, `target_score`, 
  `telegram_username`, `is_subscribed`, `points`
) VALUES (
  'usr-yoska-owner', 
  'yassooooo27m@gmail.com', 
  'Yoska', 
  'super_admin', 
  1, 
  100, 
  'yassien_ahmed', 
  1, 
  9999
) ON DUPLICATE KEY UPDATE 
  `role` = 'super_admin',
  `role_id` = 1,
  `is_subscribed` = 1;

-- ------------------------------------------------------------------------------
-- 5. جدول الاشتراكات والعمليات المالية (subscriptions)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `subscriptions` (
  `id` VARCHAR(64) NOT NULL,
  `user_id` VARCHAR(64) NOT NULL,
  `user_email` VARCHAR(191) DEFAULT NULL,
  `telegram_id` BIGINT DEFAULT NULL,
  `plan` VARCHAR(50) NOT NULL DEFAULT 'annual',
  `amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `currency` VARCHAR(10) NOT NULL DEFAULT 'EGP',
  `payment_method` VARCHAR(50) NOT NULL DEFAULT 'kashier',
  `payment_status` ENUM('pending', 'confirmed', 'completed', 'expired', 'cancelled') NOT NULL DEFAULT 'confirmed',
  `starts_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at` DATETIME DEFAULT NULL,
  `notes` TEXT DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_sub_user_id` (`user_id`),
  KEY `idx_sub_user_email` (`user_email`),
  KEY `idx_sub_status` (`payment_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 6. جدول نتائج المحاكيات والاختبارات (exam_results)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `exam_results` (
  `id` VARCHAR(64) NOT NULL,
  `user_id` VARCHAR(64) NOT NULL,
  `telegram_id` VARCHAR(64) DEFAULT NULL,
  `user_email` VARCHAR(191) DEFAULT NULL,
  `exam_name` VARCHAR(255) NOT NULL,
  `score` INT NOT NULL DEFAULT 0,
  `total_questions` INT NOT NULL DEFAULT 0,
  `correct_answers` INT NOT NULL DEFAULT 0,
  `wrong_answers` INT NOT NULL DEFAULT 0,
  `percentage` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `time_taken` INT NOT NULL DEFAULT 0,
  `answers_data` LONGTEXT DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_result_user_id` (`user_id`),
  KEY `idx_result_telegram_id` (`telegram_id`),
  KEY `idx_result_exam_name` (`exam_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 7. جدول وحدات ومسارات الدورات (course_modules)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `course_modules` (
  `id` VARCHAR(64) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT DEFAULT NULL,
  `instructor` VARCHAR(100) DEFAULT 'طرقع',
  `order_index` INT NOT NULL DEFAULT 0,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 8. جدول المحاضرات والدروس (course_lessons)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `course_lessons` (
  `id` VARCHAR(64) NOT NULL,
  `module_id` VARCHAR(64) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT DEFAULT NULL,
  `video_url` TEXT DEFAULT NULL,
  `video_provider` VARCHAR(50) DEFAULT 'direct',
  `duration` INT NOT NULL DEFAULT 0,
  `order_index` INT NOT NULL DEFAULT 0,
  `is_free` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_lesson_module` (`module_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 9. جدول تقدم الطالب في المحاضرات (user_lesson_progress)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `user_lesson_progress` (
  `id` VARCHAR(64) NOT NULL,
  `user_id` VARCHAR(64) NOT NULL,
  `lesson_id` VARCHAR(64) NOT NULL,
  `is_completed` TINYINT(1) NOT NULL DEFAULT 0,
  `watched_seconds` INT NOT NULL DEFAULT 0,
  `last_watched_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_user_lesson` (`user_id`, `lesson_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 10. جدول إعدادات المنصة وحالة الصيانة (platform_settings)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `platform_settings` (
  `setting_key` VARCHAR(100) NOT NULL,
  `setting_value` LONGTEXT DEFAULT NULL,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `platform_settings` (`setting_key`, `setting_value`) VALUES
('simulator_status', '{"is_locked":true,"message":"المحاكي مغلق حالياً للتحديثات الشاملة وسيتوفر قريباً جداً"}'),
('maintenance_mode', '{"enabled":false,"message":"المنصة تعمل بصورة طبيعية"}')
ON DUPLICATE KEY UPDATE `updated_at` = CURRENT_TIMESTAMP;

SET FOREIGN_KEY_CHECKS = 1;

