/**
 * ============================================================================
 * أدوات الأمان والتعقيم الصارم (Security & Sanitization Core)
 * ============================================================================
 * تضمن خلو الموقع من ثغرات:
 * 1. XSS (Cross-Site Scripting) عبر الروابط أو نصوص SVG
 * 2. حقن المخططات غير الآمنة (javascript:, data:text/html, vbscript:)
 * 3. التلاعب بأنواع الرتب والبيانات الحساسة
 */

/**
 * فحص وتعقيم الروابط لمنع هجمات javascript: و data: URLs
 */
export const sanitizeUrl = (url?: string | null, fallback: string = '#'): string => {
  if (!url || typeof url !== 'string') return fallback;

  const trimmed = url.trim();
  if (!trimmed) return fallback;

  // فحص المخططات الخطرة
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('data:text/html') ||
    lower.startsWith('data:application/javascript') ||
    lower.startsWith('file:') ||
    lower.includes('javascript&colon;')
  ) {
    console.warn('[Security Guard] Blocked potentially malicious URI scheme:', lower.slice(0, 30));
    return fallback;
  }

  // السماح بالروابط الآمنة: https, http, vault, blob, data:pdf, mailto, tel, أو روابط نسبية
  if (
    trimmed.startsWith('https://') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('vault://') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('data:application/pdf') ||
    trimmed.startsWith('mailto:') ||
    trimmed.startsWith('tel:') ||
    trimmed.startsWith('/') ||
    trimmed.startsWith('#')
  ) {
    return trimmed;
  }

  // إذا كان رابط خارجي مجرداً (مثال: tarqa.app/file.pdf)
  if (trimmed.includes('.') && !trimmed.includes(' ')) {
    return 'https://' + trimmed;
  }

  return trimmed;
};

/**
 * تعقيم رسومات SVG التوضيحية لمنع حقن السكربتات والأحداث الخبيثة
 */
export const sanitizeSvg = (svg?: string | null): string => {
  if (!svg || typeof svg !== 'string') return '';

  return svg
    // إزالة وسوم السكربت بالكامل
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // إزالة أحداث DOM (onload, onerror, onclick, onmouseover...)
    .replace(/\s+on\w+\s*=\s*(['"]).*?\1/gi, '')
    .replace(/\s+on\w+\s*=\s*[^>\s]+/gi, '')
    // إزالة روابط javascript: داخل href و xlink:href
    .replace(/href\s*=\s*(['"])\s*javascript:.*?\1/gi, 'href="#"')
    .replace(/xlink:href\s*=\s*(['"])\s*javascript:.*?\1/gi, 'xlink:href="#"')
    // إزالة عناصر التضمين الخطرة
    .replace(/<(object|embed|iframe|foreignobject)\b[^<]*(?:(?!<\/\1>)<[^<]*)*<\/\1>/gi, '');
};

/**
 * فحص صحة الرتبة لمنع إدخال رتب وهمية
 */
export const isValidRole = (role: unknown): boolean => {
  return role === 'student' || role === 'teacher' || role === 'admin' || role === 'super_admin';
};

/**
 * القائمة البيضاء المعتمدة لحسابات مالك المنصة (Super Admin & Platform Owner)
 */
export const OWNER_EMAILS = Object.freeze([
  'yassooooo27m@gmail.com',
  'iyoskalg@gmail.com',
] as const);

/**
 * التحقق المركزي الموحد مما إذا كان البريد الإلكتروني يخص مالك المنصة
 */
export const isOwnerEmail = (email?: string | null): boolean => {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return OWNER_EMAILS.includes(normalized as any);
};
