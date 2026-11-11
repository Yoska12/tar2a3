import { getSupabaseAdminClient } from '../lib/db';
import { TelegramWebhookUpdate } from '../types/telegram.types';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
export const TELEGRAM_BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME || 'Tarqa3bot';

export class TelegramService {
  /**
   * إرسال رسالة نصية عبر Telegram Bot API
   */
  static async sendMessage(chatId: number | string, text: string, parseMode = 'HTML'): Promise<boolean> {
    if (!TELEGRAM_BOT_TOKEN) {
      console.warn('[TelegramService] TELEGRAM_BOT_TOKEN is not configured.');
      return false;
    }

    try {
      const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: parseMode,
        }),
      });

      const data = await res.json();
      return data.ok;
    } catch (err) {
      console.error('[TelegramService] SendMessage error:', err);
      return false;
    }
  }

  /**
   * معالجة تحديثات Webhook وأوامر البوت (/score, /daily_question, /start)
   */
  static async handleWebhookUpdate(update: TelegramWebhookUpdate): Promise<{ handled: boolean; replyText?: string }> {
    const msg = update.message;
    if (!msg || !msg.text) return { handled: false };

    const chatId = msg.chat.id;
    const text = msg.text.trim();
    const command = text.split(' ')[0].toLowerCase();
    const supabase = getSupabaseAdminClient();

    // 1. الأمر /start
    if (command === '/start') {
      const welcome = `
👋 <b>أهلاً بك في بوت منصة طرقع للكمي 🎯</b>

هنا يمكنك متابعة دوراتك والاشتراك وتلقي تنبيهات الشروحات وحيل التأسيس اليومية.

<b>الأوامر المتاحة:</b>
🎯 /score - عرض حسابك ومستواك الحالي
⚡ /daily_question - استلام حيلة وفائدة كمي ذكية للحل السريع
📖 /help - المساعدة وقائمة التعليمات
      `.trim();

      await this.sendMessage(chatId, welcome);
      return { handled: true, replyText: welcome };
    }

    // 2. الأمر /score (استرجاع آخر نتيجة ومستوى الطالب)
    if (command === '/score') {
      let scoreMessage = 'لم يتم العثور على حساب مرتبط بهذا التيليجرام بعد. يرجى تسجيل الدخول في المنصة أولاً.';

      try {
        const fromId = msg.from?.id;
        const fromUsername = msg.from?.username;

        if (fromId || fromUsername) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, target_score, role')
            .or(`telegram_id.eq.${fromId},telegram_username.ilike.${fromUsername}`)
            .maybeSingle();

          if (profile) {
            scoreMessage = `
👤 <b>الطالب:</b> ${profile.full_name || 'طالب طرقع'}
🎯 <b>الهدف المطلوب:</b> ${profile.target_score || 100}
🏆 <b>الرتبة الحالية:</b> ${profile.role === 'admin' ? 'مشرف المنصة 👑' : 'طالب نخبوي 🎓'}

تابع شروحات التأسيس وحيل طرقع عبر الموقع لتثبيت الحل الذهني السريع!
            `.trim();
          }
        }
      } catch (e) {
        console.warn('[TelegramService] Score lookup error:', e);
      }

      await this.sendMessage(chatId, scoreMessage);
      return { handled: true, replyText: scoreMessage };
    }

    // 3. الأمر /daily_question (حيلة كمي يومية ذكية)
    if (command === '/daily_question' || command === '/daily_tip') {
      const tips = [
        '📐 في المثلث القائم 30-60: الضلع المقابل للزاوية 30° يساوي نصف طول الوتر مباشرة بدون فيثاغورس!',
        '🔢 لضرب أي عدد في 5 ذهنياً: اقسم العدد على 2 ثم ضع صفر أو حرك الفاصلة لليمين.',
        '⚡ لحساب النسبة المئوية سريعاً: 10% تعني تحريك الفاصلة خانة لليسار، 5% هي نصف الـ 10%.',
        '💡 في مسائل السرعة والمسافة: المسافة = السرعة × الزمن، وعند حركة جسمين في نفس الاتجاه نطرح السرعتين.',
        '🎯 مربع أي عدد آحاده 5 (مثل 35²): اضرب العشرات في التالي (3 × 4 = 12) ثم ألحق 25 فيصبح 1225!'
      ];
      const selectedTip = tips[Math.floor(Math.random() * tips.length)];

      const tipMsg = `
⚡ <b>حيلة طرقع السريعة لليوم 🎯</b>

${selectedTip}

💡 <i>تدرب على الحل الذهني السريع دائماً في منصة طرقع!</i>
      `.trim();

      await this.sendMessage(chatId, tipMsg);
      return { handled: true, replyText: tipMsg };
    }

    // 4. الأمر /help
    if (command === '/help') {
      const help = `
📚 <b>دليل بوت منصة طرقع للكمي:</b>

• /score - لعرض بيانات حسابك وهدفك
• /daily_question - للحصول على حيلة كمي ذكية للحل السريع
• /start - بدء المحادثة وتأكيد الربط

<b>هدفنا 100 🎯</b>
      `.trim();
      await this.sendMessage(chatId, help);
      return { handled: true, replyText: help };
    }

    return { handled: false };
  }
}
