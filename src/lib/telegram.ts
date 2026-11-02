// 🚀 تكامل بوت تليجرام لمنصة طرقع (@Tarqa3bot)
// Telegram Bot API Integration & Login Verification via Secure Backend Gateway

// ملاحظة أمنية: توكن البوت محجوب 100% عن الفرونت إند ومحفوظ حصراً في السيرفر الخلفي (/api/telegram.php)
export const TELEGRAM_BOT_TOKEN = '';

export const TELEGRAM_BOT_USERNAME = 
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_TELEGRAM_BOT_USERNAME) ||
  (typeof process !== 'undefined' && process.env?.TELEGRAM_BOT_USERNAME) ||
  'Tarqa3bot';

export const TELEGRAM_BOT_URL = `https://t.me/${TELEGRAM_BOT_USERNAME}`;

/**
 * دالة مساعدة لإرسال رسالة إلى مستخدم عبر بوابة تليجرام الآمنة (Server Gateway)
 */
export async function sendTelegramMessage(
  chatId: string | number,
  text: string,
  parseMode: 'HTML' | 'Markdown' = 'HTML'
): Promise<{ success: boolean; error?: string }> {
  // 1. التوجيه لبوابة السيرفر الخلفية الآمنة (حيث التوكن محمي ومشفر 100%)
  const endpoints = ['/api/telegram.php?action=send_message', '/api/telegram'];
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_message',
          chat_id: chatId,
          text,
          parse_mode: parseMode,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.ok || data.success) {
          return { success: true };
        }
      }
    } catch {
      // تجربة النقطة البديلة التالية
    }
  }

  return { success: false, error: 'Could not connect to telegram gateway' };
}

/**
 * إرسال رسالة ترحيبية فورية عند إنشاء الحساب أو تسجيل الدخول
 */
export async function sendWelcomeTelegramMessage(
  chatId: string | number,
  fullName: string,
  _targetScore: number = 100
) {
  const message = `
👋 أهلاً <b>${fullName}</b>، تم ربط حسابك في منصة طرقع بنجاح ✅
🎯 فالك الـ 100 بإذن الله!
`;

  return sendTelegramMessage(chatId, message.trim(), 'HTML');
}

/**
 * إرسال إشعار فوري عند إتمام اختبار في المنصة
 */
export async function sendQuizCompletedNotification(
  chatId: string | number,
  fullName: string,
  quizTitle: string,
  scorePercentage: number,
  _totalQuestions: number,
  timeSpentSeconds: number
) {
  const minutes = Math.floor(timeSpentSeconds / 60);
  const seconds = timeSpentSeconds % 60;
  const timeFormatted = `${minutes}د ${seconds}ث`;

  const message = `
📊 <b>نتيجة: ${quizTitle}</b>
👤 <b>${fullName}</b> | الدرجة: <b>${scorePercentage}%</b> | الوقت: <b>${timeFormatted}</b>
🎯 فالك الـ 100!
`;

  return sendTelegramMessage(chatId, message.trim(), 'HTML');
}

/**
 * بيانات مستخدم تليجرام الموثق من ويدجت تسجيل الدخول
 */
export interface TelegramUserData {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

/**
 * التحقق الأمني من صحة بيانات تسجيل الدخول عبر تليجرام (Telegram Login Widget Verification)
 * يتم التحقق حصراً عبر السيرفر الخلفي المشفر لحماية توكن البوت ومنع أي تلاعب
 */
export async function verifyTelegramAuth(
  authData: Record<string, any>
): Promise<{ isValid: boolean; user?: TelegramUserData; error?: string }> {
  const { hash, ...dataToCheck } = authData;

  if (!hash) {
    return { isValid: false, error: 'Missing hash in Telegram payload' };
  }

  const authDate = Number(dataToCheck.auth_date);
  const now = Math.floor(Date.now() / 1000);
  if (authDate && now - authDate > 86400) {
    return { isValid: false, error: 'Telegram authentication data is expired' };
  }

  // إرسال طلب التحقق الأمني إلى بوابة السيرفر الخلفية المشفرة
  const endpoints = ['/api/telegram.php?action=verify_auth', '/api/telegram'];
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'verify_auth',
          authData,
        }),
      });

      if (response.ok) {
        const res = await response.json();
        if (res.isValid !== undefined) {
          return {
            isValid: Boolean(res.isValid),
            user: res.user || {
              id: Number(dataToCheck.id),
              first_name: dataToCheck.first_name,
              last_name: dataToCheck.last_name,
              username: dataToCheck.username,
              photo_url: dataToCheck.photo_url,
              auth_date: authDate || now,
              hash,
            },
            error: res.error,
          };
        }
      }
    } catch {
      // تجربة النقطة البديلة التالية
    }
  }

  return {
    isValid: false,
    error: 'تعذر التحقق من التوقيع عبر خادم المنصة الآمن',
  };
}

