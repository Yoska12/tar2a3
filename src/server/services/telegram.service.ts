import { getSupabaseAdminClient } from '../lib/db';
import { TelegramWebhookUpdate } from '../types/telegram.types';
import { QuizSubmissionResult } from '../types/quiz.types';
import { mockQuestions } from '../../data/mockQuestions';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8978106095:AAEDS6L3u0g3jHAKMk9YUksjkqKu8nt8QlU';
export const TELEGRAM_BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME || 'heartqdbot';

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

هنا يمكنك متابعة درجاتك وتلقي تنبيهات الاختبارات والمسائل اليومية الذكية.

<b>الأوامر المتاحة:</b>
🎯 /score - عرض آخر نتيجة ودرجتك الحالية
⚡ /daily_question - استلام مسألة كمي سريعة للتدريب
📖 /help - المساعدة وقائمة التعليمات
      `.trim();

      await this.sendMessage(chatId, welcome);
      return { handled: true, replyText: welcome };
    }

    // 2. الأمر /score (استرجاع آخر نتيجة ومستوى الطالب)
    if (command === '/score') {
      let scoreMessage = 'لم يتم العثور على حساب مرتبط بهذا التيليجرام بعد. يرجى تسجيل الدخول في المنصة أولاً.';

      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, full_name, target_score')
          .or(`telegram_chat_id.eq.${chatId},telegram_id.eq.${chatId}`)
          .maybeSingle();

        if (profile) {
          const { data: lastAttempt } = await supabase
            .from('user_quiz_attempts')
            .select('score, correct_count, total_questions, time_spent_seconds, completed_at')
            .eq('user_id', profile.id)
            .order('completed_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (lastAttempt) {
            scoreMessage = `
📊 <b>سجل درجات الطالب: ${profile.full_name}</b>

🎯 <b>آخر نتيجة:</b> ${lastAttempt.score}%
✅ <b>الإجابات الصحيحة:</b> ${lastAttempt.correct_count} من ${lastAttempt.total_questions}
⏱ <b>الوقت:</b> ${Math.round(lastAttempt.time_spent_seconds / 60)} دقيقة
🎯 <b>الدرجة المستهدفة:</b> ${profile.target_score || 100}

<b>هدفنا 100 🎯</b> استمر في الطرقعة والتدريب!
            `.trim();
          } else {
            scoreMessage = `مرحباً ${profile.full_name}! لم تقم بإنهاء أي اختبار بعد. ادخل المنصة وطرقع أول اختبار الآن! 🎯`;
          }
        }
      } catch (e) {
        console.warn('[TelegramService] Score lookup error:', e);
      }

      await this.sendMessage(chatId, scoreMessage);
      return { handled: true, replyText: scoreMessage };
    }

    // 3. الأمر /daily_question (مسألة كمي يومية ذكية)
    if (command === '/daily_question') {
      const randomQ = mockQuestions[Math.floor(Math.random() * mockQuestions.length)];
      const optionsText = randomQ.options
        .map((opt) => `<b>[${opt.id}]</b> ${opt.text}`)
        .join('\n');

      const questionMsg = `
⚡ <b>مسألة طرقع السريعة لليوم 🎯</b>
<i>${randomQ.categoryId === 'geometry' ? '📐 هندسة' : '🔢 حساب وجبر'}</i>

❓ <b>السؤال:</b>
${randomQ.questionText}

${optionsText}

💡 <i>فكر وحل ذهنياً بأسرع طريقة!</i>
      `.trim();

      await this.sendMessage(chatId, questionMsg);
      return { handled: true, replyText: questionMsg };
    }

    // 4. الأمر /help
    if (command === '/help') {
      const help = `
📚 <b>دليل بوت منصة طرقع للكمي:</b>

• /score - لعرض درجاتك وتقرير إتقانك
• /daily_question - للحصول على مسألة كمي ذكية للتدريب
• /start - بدء المحادثة وتأكيد الربط

<b>هدفنا 100 🎯</b>
      `.trim();
      await this.sendMessage(chatId, help);
      return { handled: true, replyText: help };
    }

    return { handled: false };
  }

  /**
   * خدمة خلفية لإرسال إشعار فوري للطالب عبر تليجرام فور تسليم الاختبار
   */
  static async sendQuizResultAlert(userId: string, result: QuizSubmissionResult): Promise<boolean> {
    const supabase = getSupabaseAdminClient();

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, telegram_chat_id, telegram_id, target_score')
        .eq('id', userId)
        .maybeSingle();

      const chatId = profile?.telegram_chat_id || profile?.telegram_id;
      if (!chatId) return false;

      const passed = result.score >= 80;
      const emoji = result.score >= 90 ? '🏆' : passed ? '👏' : '💪';

      const alertText = `
${emoji} <b>تم تصحيح اختبارك في منصة طرقع للكمي!</b>

👤 <b>الطالب:</b> ${profile.full_name || 'طالب طرقع'}
🎯 <b>الدرجة المحققة:</b> <b>${result.score}%</b>
✅ <b>الإجابات الصحيحة:</b> ${result.correctCount} من ${result.totalQuestions}
⏱ <b>الوقت الإجمالي:</b> ${Math.round(result.timeSpentSeconds / 60)} دقيقة (${result.averageTimePerQuestion} ثانية/سؤال)
🎯 <b>الهدف المطلوب:</b> ${profile.target_score || 100}

${result.score >= 90 ? '🔥 أداء نخبوي رائع، أنت على طريق الـ 100 بإذن الله!' : 'راجع شروحات وحيل طرقع في المنصة لتثبيت الحل الذهني السريع.'}
      `.trim();

      return await this.sendMessage(chatId, alertText);
    } catch (err) {
      console.warn('[TelegramService] Alert dispatch failed:', err);
      return false;
    }
  }
}
