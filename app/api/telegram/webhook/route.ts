import { NextRequest } from 'next/server';
import { apiSuccess, apiBadRequest, apiError } from '@/server/lib/response';
import { TelegramService } from '@/server/services/telegram.service';
import { TelegramWebhookUpdate } from '@/server/types/telegram.types';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as TelegramWebhookUpdate;
    if (!body || typeof body.update_id === 'undefined') {
      return apiBadRequest('تحديث Telegram غير صالح');
    }

    const result = await TelegramService.handleWebhookUpdate(body);

    return apiSuccess({
      received: true,
      handled: result.handled,
    });
  } catch (err: any) {
    console.error('[POST /api/telegram/webhook] Error:', err);
    return apiError(err?.message || 'خطأ في معالجة ويب هوك تليجرام');
  }
}
