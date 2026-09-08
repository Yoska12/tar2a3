import { NextResponse } from 'next/server';
import { ApiResponse } from '../types/api.types';

// ==============================================================================
// 🚀 استجابات JSON موحدة واحترافية لكافة نقاط النهاية
// ==============================================================================

export function apiSuccess<T>(data: T, status = 200, init?: ResponseInit): NextResponse<ApiResponse<T>> {
  return NextResponse.json(
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
): NextResponse<ApiResponse<null>> {
  return NextResponse.json(
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

export function apiBadRequest(message: string): NextResponse<ApiResponse<null>> {
  return apiError(message, 400);
}

export function apiUnauthorized(message = 'يجب تسجيل الدخول أولاً للوصول إلى هذا المسار'): NextResponse<ApiResponse<null>> {
  return apiError(message, 401);
}

export function apiForbidden(message = 'ليس لديك صلاحية الوصول إلى هذه النتيجة'): NextResponse<ApiResponse<null>> {
  return apiError(message, 403);
}

export function apiNotFound(message = 'العنصر المطلوب غير موجود'): NextResponse<ApiResponse<null>> {
  return apiError(message, 404);
}
