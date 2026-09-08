import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyTelegramAuth, sendWelcomeTelegramMessage } from '@/lib/telegram';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // 1. التحقق الأمني من توقيع تليجرام
    const verification = verifyTelegramAuth(body);
    if (!verification.isValid || !verification.user) {
      return NextResponse.json(
        { success: false, error: verification.error || 'فشل التحقق من صحة بيانات تليجرام' },
        { status: 401 }
      );
    }

    const tgUser = verification.user;
    const fullName = [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ') || 'طالب طرقع';
    const telegramEmail = `tg_${tgUser.id}@tarqa.internal`;

    // 2. الاتصال بـ Supabase بصلاحيات Service Role لإدارة الحسابات
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'بيانات خادم Supabase غير مكتملة (تأكد من إعداد SUPABASE_SERVICE_ROLE_KEY).' 
        },
        { status: 500 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 3. البحث عما إذا كان المستخدم مسجلاً مسبقاً بهذا الـ telegram_id
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, telegram_id')
      .eq('telegram_id', tgUser.id)
      .maybeSingle();

    let userId: string;

    if (existingProfile) {
      userId = existingProfile.id;
    } else {
      // 4. إنشاء مستخدم جديد في Supabase Auth
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: telegramEmail,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          avatar_url: tgUser.photo_url || '',
          telegram_id: tgUser.id,
          telegram_username: tgUser.username || '',
          telegram_chat_id: tgUser.id,
          target_score: 100,
        },
      });

      if (createError) {
        // إذا كان الإيميل مسجلاً بالفعل، نحصل على المستخدم بواسطة البريد
        const { data: existingUser } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('id', (await supabaseAdmin.auth.admin.listUsers()).data.users.find(u => u.email === telegramEmail)?.id || '')
          .maybeSingle();

        if (existingUser) {
          userId = existingUser.id;
        } else {
          return NextResponse.json(
            { success: false, error: createError.message },
            { status: 500 }
          );
        }
      } else {
        userId = newUser.user.id;

        // إرسال رسالة ترحيبية عبر بوت التليجرام للطالب الجديد
        try {
          await sendWelcomeTelegramMessage(tgUser.id, fullName, 100);
        } catch (e) {
          console.warn('[Telegram] Could not send welcome message:', e);
        }
      }
    }

    // 5. إنشاء رابط سحري / Session Token لدخول فوري
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: telegramEmail,
    });

    if (linkError) {
      return NextResponse.json(
        { success: false, error: linkError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'تم تسجيل الدخول بنجاح عبر تليجرام',
      user: {
        id: userId,
        fullName,
        username: tgUser.username,
        photoUrl: tgUser.photo_url,
      },
      tokenHash: linkData.properties?.hashed_token,
      redirectUrl: linkData.properties?.action_link,
    });
  } catch (error: any) {
    console.error('[API Telegram Auth Error]:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'حدث خطأ داخلي أثناء المعالجة' },
      { status: 500 }
    );
  }
}
