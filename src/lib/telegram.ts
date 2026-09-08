import crypto from 'crypto';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

/**
 * دالة مساعدة لإرسال رسالة إلى مستخدم عبر Telegram Bot API
 */
export async function sendTelegramMessage(
  chatId: string | number,
  text: string,
  parseMode: 'HTML' | 'Markdown' = 'HTML'
): Promise<{ success: boolean; error?: string }> {
  if (!TELEGRAM_BOT_TOKEN) {
    console.warn('[Telegram Bot] TELEGRAM_BOT_TOKEN is not configured.');
    return { success: false, error: 'TELEGRAM_BOT_TOKEN is not set' };
  }

  try {
    const response = await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: parseMode,
        disable_web_page_preview: true,
      }),
    });

    const data = await response.json();
    if (!data.ok) {
      console.error('[Telegram Bot] Send message failed:', data.description);
      return { success: false, error: data.description };
    }

    return { success: true };
  } catch (err: any) {
    console.error('[Telegram Bot] Error sending message:', err);
    return { success: false, error: err?.message || 'Network error' };
  }
}

/**
 * إرسال رسالة ترحيبية فورية عند إنشاء الحساب
 */
export async function sendWelcomeTelegramMessage(
  chatId: string | number,
  fullName: string,
  targetScore: number = 100
) {
  const message = `
🎉 <b>أهلاً بك يا ${fullName} في منصة طرقع للكمي!</b> 🎯

لقد تم تفعيل حسابك بنجاح. درجتك المستهدفة في القدرات: <b>${targetScore} 🎯</b> بإذن الله.

💡 <b>نصائح طرقع السريعة لانطلاقتك:</b>
1. <b>ابدأ بالتدريب الفوري:</b> اكشف حيل التدرج المنتظم وطرق الحل السريع في ثوانٍ.
2. <b>خض تحدي السرعة (45 ثانية):</b> لتعتاد على حل الأسئلة ذهنياً دون خطوات طويلة.
3. <b>جرّب محاكي قياس الكامل:</b> لتعيش أجواء الاختبار الفعلي بدقة.

🔥 <i>مع طرقع.. هدفنا الـ 100 وما فيه مسألة تعوق معك!</i>
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
  totalQuestions: number,
  timeSpentSeconds: number
) {
  const minutes = Math.floor(timeSpentSeconds / 60);
  const seconds = timeSpentSeconds % 60;
  const timeFormatted = `${minutes}د ${seconds}ث`;

  let badge = '💪 استمر في التدريب!';
  if (scorePercentage >= 90) badge = '🌟 مستوى أسطوري (100)! طرقعتها بجدارة!';
  else if (scorePercentage >= 75) badge = '👏 أداء رائع جداً!';

  const message = `
📊 <b>نتيجة اختبار جديدة - منصة طرقع</b>

مرحباً <b>${fullName}</b>، لقد أنهيت للتو:
📝 <i>${quizTitle}</i>

🏆 <b>الدرجة المحققة:</b> <code>${scorePercentage}%</code>
⏱️ <b>الوقت المستغرق:</b> <code>${timeFormatted}</code>
📌 <b>عدد الأسئلة:</b> <code>${totalQuestions}</code>

${badge}
🔍 يمكنك الدخول إلى المنصة لمراجعة الأسئلة الخاطئة وحيل الحل السريع.
`;

  return sendTelegramMessage(chatId, message.trim(), 'HTML');
}

/**
 * التحقق الأمني من صحة بيانات تسجيل الدخول عبر تليجرام (Telegram Login Widget Verification)
 * وفق المواصفات الرسمية من Telegram:
 * 1. جمع المعاملات وترتيبها أبجدياً ما عدا hash
 * 2. صياغتها بصيغة key=value\n
 * 3. تشفير مفتاح التوكن بـ SHA256
 * 4. حساب HMAC-SHA-256 ومقارنته بالـ hash المستلم
 * 5. فحص صلاحية auth_date (أقل من 24 ساعة)
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

export function verifyTelegramAuth(
  authData: Record<string, any>,
  botToken: string = TELEGRAM_BOT_TOKEN
): { isValid: boolean; user?: TelegramUserData; error?: string } {
  if (!botToken) {
    return { isValid: false, error: 'Telegram Bot Token is not configured' };
  }

  const { hash, ...dataToCheck } = authData;

  if (!hash) {
    return { isValid: false, error: 'Missing hash in Telegram payload' };
  }

  // 1. التأكد من أن التوقيع حديث (أقل من 24 ساعة = 86400 ثانية)
  const authDate = Number(dataToCheck.auth_date);
  const now = Math.floor(Date.now() / 1000);
  if (!authDate || now - authDate > 86400) {
    return { isValid: false, error: 'Telegram authentication data is expired' };
  }

  // 2. تجميع وترتيب المتغيرات بصيغة key=value
  const checkString = Object.keys(dataToCheck)
    .sort()
    .map((key) => `${key}=${dataToCheck[key]}`)
    .join('\n');

  // 3. إنشاء المفتاح السري عبر SHA256 للتوكن
  const secretKey = crypto.createHash('sha256').update(botToken).digest();

  // 4. توليد الـ HMAC-SHA-256 للمقارنة
  const hmac = crypto
    .createHmac('sha256', secretKey)
    .update(checkString)
    .digest('hex');

  // 5. مقارنة التوقيعين بزمن ثابت (Timing-safe comparison)
  const isMatch = crypto.timingSafeEqual(
    Buffer.from(hmac, 'hex'),
    Buffer.from(hash, 'hex')
  );

  if (!isMatch) {
    return { isValid: false, error: 'Invalid Telegram data signature (Hash mismatch)' };
  }

  return {
    isValid: true,
    user: {
      id: Number(dataToCheck.id),
      first_name: dataToCheck.first_name,
      last_name: dataToCheck.last_name,
      username: dataToCheck.username,
      photo_url: dataToCheck.photo_url,
      auth_date: authDate,
      hash,
    },
  };
}
