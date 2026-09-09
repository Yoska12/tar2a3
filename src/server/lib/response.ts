import { ApiResponse } from '../types/api.types';

// ==============================================================================
// 🚀 استجابات JSON موحدة واحترافية متوافقة مع Web API القياسي
// ==============================================================================

export function apiSuccess<T>(data: T, status = 200, init?: ResponseInit): Response {
  return Response.json(
    {
      success: true,
      data,
      meta: {
        timestamp: new Date().toISOString(),
      },
    },
    { status, ...init }
  );
}

export function apiError(
  message = 'حدث خطأ غير متوقع في الخادم',
  status = 500
): Response {
  return Response.json(
    {
      success: false,
      error: message,
      meta: {
        timestamp: new Date().toISOString(),
      },
    },
    { status }
  );
}

export function apiBadRequest(message: string): Response {
  return apiError(message, 400);
}

export function apiUnauthorized(message = 'يجب تسجيل الدخول أولاً للوصول إلى هذا المسار'): Response {
  return apiError(message, 401);
}

export function apiForbidden(message = 'ليس لديك صلاحية الوصول إلى هذه النتيجة'): Response {
  return apiError(message, 403);
}

export function apiNotFound(message = 'العنصر المطلوب غير موجود'): Response {
  return apiError(message, 404);
}
