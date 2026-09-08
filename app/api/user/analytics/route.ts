import { NextRequest } from 'next/server';
import { getAuthenticatedUser } from '@/server/lib/auth';
import { apiSuccess, apiUnauthorized, apiError } from '@/server/lib/response';
import { AnalyticsService } from '@/server/services/analytics.service';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return apiUnauthorized('يجب تسجيل الدخول لعرض تقرير الأداء والإحصائيات.');
    }

    const report = await AnalyticsService.getUserAnalytics(user.id);

    return apiSuccess(report);
  } catch (err: any) {
    console.error('[GET /api/user/analytics] Error:', err);
    return apiError(err?.message || 'تعذر حساب تقرير التحليلات');
  }
}
