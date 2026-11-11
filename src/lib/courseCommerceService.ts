/**
 * ============================================================================
 * 🛒 منصة طرقع - نظام التجارة الإلكترونية، تسعير الدورات، والكوبونات والإيصالات
 * Course Commerce, Independent Pricing, Promo Codes & Payment Receipts
 * ============================================================================
 * مربوط مباشرة بقاعدة البيانات وخادم هوستينجر (Hostinger MySQL Backend):
 * 1. الأسعار غير مخزنة بشكل ثابت في الواجهة وتُجلب وتُعدل من السيرفر.
 * 2. التحقق من أكواد الخصم يتم بالكامل على السيرفر (Server-Side Calculation).
 * 3. دفع وتفعيل مستقل لكل دورة تدريبية (Per-Course Independent Enrollment).
 * 4. توليد إيصالات الدفع وإرسال إشعار فوري على واتساب الإدارة والبريد الإلكتروني.
 */

import { TarqaUser } from './supabase';

export interface CoursePriceItem {
  course_id: string;
  course_title: string;
  price_sar: number;
  price_egp: number;
  is_active: number | boolean;
}

export interface PromoCodeItem {
  id: string;
  code: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  course_id?: string | null;
  max_uses?: number;
  used_count?: number;
  is_active: boolean | number;
  expires_at?: string | null;
  created_at?: string;
}

export interface PromoValidationResult {
  valid: boolean;
  code: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  original_price: number;
  discount_amount: number;
  final_price: number;
  currency: 'SAR' | 'EGP';
  course_id: string;
  course_title?: string;
  message: string;
}

export interface PaymentReceipt {
  id: string;
  order_id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  user_phone?: string;
  course_id: string;
  course_title: string;
  original_price: number;
  discount_amount: number;
  final_price: number;
  currency: 'SAR' | 'EGP';
  promo_code?: string;
  payment_method: string;
  payment_status: 'PAID' | 'PENDING' | 'CANCELLED';
  created_at: string;
}

export interface ReceiptSettings {
  admin_whatsapp: string;
  admin_email: string;
  telegram_chat_id?: string;
}

// ----------------------------------------------------------------------------
// 1. إدارة واستعلام أسعار الدورات من قاعدة البيانات
// ----------------------------------------------------------------------------
export const courseCommerceService = {
  /**
   * جلب الأسعار المعتمدة لجميع الدورات مباشرة من قاعدة البيانات
   */
  async getCoursePricing(): Promise<CoursePriceItem[]> {
    try {
      const res = await fetch(`/api/hostinger_api.php?action=get_course_pricing&_t=${Date.now()}`, {
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.success && Array.isArray(data.pricing)) {
          localStorage.setItem('tarqa_course_pricing_cache', JSON.stringify(data.pricing));
          return data.pricing;
        }
      }
    } catch (e) {
      console.warn('[Commerce] Failed to fetch pricing from DB:', e);
    }

    // قراءة من الكاش المحلي إن تعذر الاتصال
    try {
      const cached = localStorage.getItem('tarqa_course_pricing_cache');
      if (cached) return JSON.parse(cached);
    } catch {}

    // القيمة الافتراضية المرجعية
    return [
      {
        course_id: 'course-foundation',
        course_title: 'دورة التأسيس الشاملة للقدرات 🎯',
        price_sar: 75,
        price_egp: 1100,
        is_active: 1,
      },
    ];
  },

  /**
   * جلب سعر دورة محددة بالريال أو الجنيه
   */
  async getCoursePrice(courseId: string): Promise<{ priceSar: number; priceEg: number; title: string }> {
    // 1. فحص الدورات المحدثة محلياً أو المخصصة بواسطة المشرف أولاً لمنع عودة السعر القديم
    let customSar: number | null = null;
    let customEg: number | null = null;
    let customTitle: string | null = null;

    try {
      const raw = localStorage.getItem('tarqa_custom_courses_v1');
      if (raw) {
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          const match = list.find((c: any) => c.id === courseId);
          if (match) {
            if (Number(match.priceEg) > 0) customEg = Number(match.priceEg);
            if (Number(match.priceSar) > 0) customSar = Number(match.priceSar);
            if (match.title) customTitle = match.title;
          }
        }
      }
    } catch {}

    // فحص إعدادات كاشير في لوحة الإدارة إذا كانت الدورة هي دورة التأسيس المعتمدة
    if (courseId === 'course-foundation') {
      try {
        const rawKashier = localStorage.getItem('tarqa_kashier_settings');
        if (rawKashier) {
          const ks = JSON.parse(rawKashier);
          if (ks.amount && Number(ks.amount) > 10) {
            if (ks.currency === 'SAR') {
              customSar = Number(ks.amount);
            } else {
              customEg = Number(ks.amount);
            }
          }
        }
      } catch {}
    }

    const all = await this.getCoursePricing();
    const found = all.find((p) => p.course_id === courseId);
    if (found) {
      return {
        priceSar: customSar ?? (Number(found.price_sar) || 75),
        priceEg: customEg ?? (Number(found.price_egp) || 1100),
        title: customTitle || found.course_title || 'دورة قدرات',
      };
    }

    return {
      priceSar: customSar ?? 75,
      priceEg: customEg ?? 1100,
      title: customTitle || 'الدورة المعتمدة'
    };
  },

  /**
   * تعديل وحفظ سعر دورة في قاعدة البيانات (للأدمن)
   */
  async updateCoursePrice(courseId: string, courseTitle: string, priceSar: number, priceEg: number): Promise<boolean> {
    try {
      // 1. تحديث الكاش المحلي فوراً
      try {
        const cachedRaw = localStorage.getItem('tarqa_course_pricing_cache');
        let cached = cachedRaw ? JSON.parse(cachedRaw) : [];
        if (!Array.isArray(cached)) cached = [];
        const idx = cached.findIndex((p: any) => p.course_id === courseId);
        const item = {
          course_id: courseId,
          course_title: courseTitle,
          price_sar: Number(priceSar),
          price_egp: Number(priceEg),
          is_active: 1,
        };
        if (idx >= 0) cached[idx] = item;
        else cached.push(item);
        localStorage.setItem('tarqa_course_pricing_cache', JSON.stringify(cached));
      } catch {}

      // 2. تحديث محلي فوري للدورة في التخزين لضمان توافق الواجهات
      try {
        const raw = localStorage.getItem('tarqa_custom_courses_v1');
        if (raw) {
          const list = JSON.parse(raw);
          if (Array.isArray(list)) {
            const updated = list.map((c: any) =>
              c.id === courseId
                ? { ...c, priceSar: Number(priceSar), priceEg: Number(priceEg), title: courseTitle || c.title }
                : c
            );
            localStorage.setItem('tarqa_custom_courses_v1', JSON.stringify(updated));
          }
        }
      } catch {}

      // 3. مزامنة مع إعدادات كاشير في لوحة الإدارة إذا كانت الدورة الأساسية
      if (courseId === 'course-foundation') {
        try {
          const rawK = localStorage.getItem('tarqa_kashier_settings');
          if (rawK) {
            const parsedK = JSON.parse(rawK);
            parsedK.amount = Number(priceEg);
            localStorage.setItem('tarqa_kashier_settings', JSON.stringify(parsedK));
            window.dispatchEvent(new CustomEvent('tarqa_kashier_settings_changed', { detail: parsedK }));
          }
        } catch {}
      }

      // 4. إرسال وتثبيت السعر في قاعدة بيانات السيرفر
      await fetch('/api/hostinger_api.php?action=update_course_price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          course_id: courseId,
          course_title: courseTitle,
          price_sar: Number(priceSar),
          price_egp: Number(priceEg),
          is_active: 1,
        }),
      }).catch(() => {});

      // إشعار المكونات والواجهات فوراً
      window.dispatchEvent(
        new CustomEvent('tarqa_course_pricing_updated', {
          detail: { courseId, priceSar: Number(priceSar), priceEg: Number(priceEg), courseTitle },
        })
      );
      window.dispatchEvent(new CustomEvent('tarqa_courses_list_changed'));
      return true;
    } catch (e) {
      console.error('[Commerce] updateCoursePrice error:', e);
      return false;
    }
  },

  // ----------------------------------------------------------------------------
  // 2. فحص وتطبيق أكواد الخصم (Promo Codes)
  // ----------------------------------------------------------------------------
  /**
   * التحقق من كود الخصم عبر السيرفر وحساب الخصم المعتمد في الباك إند
   */
  async validatePromoCode(
    code: string,
    courseId: string,
    currency: 'SAR' | 'EGP' = 'SAR'
  ): Promise<PromoValidationResult> {
    const cleanCode = (code || '').toUpperCase().trim();
    if (!cleanCode) {
      return {
        valid: false,
        code: '',
        discount_type: 'percentage',
        discount_value: 0,
        original_price: currency === 'EGP' ? 1100 : 75,
        discount_amount: 0,
        final_price: currency === 'EGP' ? 1100 : 75,
        currency,
        course_id: courseId,
        message: 'يرجى إدخال رمز كود الخصم',
      };
    }

    try {
      const url = `/api/hostinger_api.php?action=validate_promo_code&code=${encodeURIComponent(
        cleanCode
      )}&course_id=${encodeURIComponent(courseId)}&currency=${currency}&_t=${Date.now()}`;
      const res = await fetch(url, { cache: 'no-store' });
      const data = await res.json();

      if (res.ok && data && data.valid) {
        return {
          valid: true,
          code: data.code,
          discount_type: data.discount_type,
          discount_value: Number(data.discount_value),
          original_price: Number(data.original_price),
          discount_amount: Number(data.discount_amount),
          final_price: Number(data.final_price),
          currency: data.currency || currency,
          course_id: data.course_id || courseId,
          course_title: data.course_title,
          message: data.message || 'تم تطبيق الخصم بنجاح!',
        };
      } else {
        return {
          valid: false,
          code: cleanCode,
          discount_type: 'percentage',
          discount_value: 0,
          original_price: currency === 'EGP' ? 1100 : 75,
          discount_amount: 0,
          final_price: currency === 'EGP' ? 1100 : 75,
          currency,
          course_id: courseId,
          message: data?.message || 'كود الخصم غير صحيح أو منتهي الصلاحية',
        };
      }
    } catch (e: any) {
      return {
        valid: false,
        code: cleanCode,
        discount_type: 'percentage',
        discount_value: 0,
        original_price: currency === 'EGP' ? 1100 : 75,
        discount_amount: 0,
        final_price: currency === 'EGP' ? 1100 : 75,
        currency,
        course_id: courseId,
        message: 'تعذر التحقق من كود الخصم حالياً، يرجى المحاولة لاحقاً',
      };
    }
  },

  /**
   * جلب قائمة جميع أكواد الخصم للوحة تحكم الأدمن
   */
  async getPromoCodes(): Promise<PromoCodeItem[]> {
    try {
      const res = await fetch(`/api/hostinger_api.php?action=get_promo_codes&_t=${Date.now()}`, {
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.success && Array.isArray(data.promo_codes)) {
          return data.promo_codes;
        }
      }
    } catch (e) {
      console.warn('[Commerce] getPromoCodes error:', e);
    }
    return [];
  },

  /**
   * إضافة أو تحديث كود خصم في قاعدة البيانات
   */
  async savePromoCode(promo: Partial<PromoCodeItem>): Promise<{ success: boolean; message: string }> {
    try {
      const res = await fetch('/api/hostinger_api.php?action=save_promo_code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(promo),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        return { success: true, message: data.message || 'تم حفظ كود الخصم بنجاح' };
      }
      return { success: false, message: data.error || 'تعذر حفظ كود الخصم' };
    } catch (e: any) {
      return { success: false, message: e.message || 'خطأ في الاتصال بالسيرفر' };
    }
  },

  /**
   * حذف كود خصم نهائياً
   */
  async deletePromoCode(idOrCode: string): Promise<boolean> {
    try {
      const res = await fetch('/api/hostinger_api.php?action=delete_promo_code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: idOrCode }),
      });
      const data = await res.json();
      return Boolean(data && data.success);
    } catch {
      return false;
    }
  },

  // ----------------------------------------------------------------------------
  // 3. تأكيد الدفع المستقل لكل دورة وتوليد الإيصال
  // ----------------------------------------------------------------------------
  /**
   * تأكيد عملية الدفع وتسجيل الاشتراك المستقل وتوليد إيصال الواتساب والإيميل
   */
  async confirmCoursePayment(payload: {
    order_id: string;
    course_id: string;
    course_title: string;
    user_id: string;
    user_name: string;
    user_email: string;
    user_phone?: string;
    currency: 'SAR' | 'EGP';
    promo_code?: string;
    payment_method: 'kashier' | 'instapay' | 'vodafone_cash' | 'admin';
  }): Promise<{ success: boolean; receipt?: PaymentReceipt; whatsapp_url?: string; message: string }> {
    try {
      const res = await fetch('/api/hostinger_api.php?action=confirm_course_payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        // تحديث حالة اشتراك الدورة محلياً فوراً
        const courseId = payload.course_id;
        const userId = payload.user_id;
        const isInstapay = payload.payment_method === 'instapay';
        // تفعيل فوري فقط لكاشير أو الإدارة، وإنستاباي ينتظر المراجعة والتفعيل اليدوي من الإدارة
        const isSubActive = isInstapay ? false : Boolean(data.subscription?.is_active ?? true);
        try {
          const raw = localStorage.getItem('tarqa_course_subscriptions') || '{}';
          const subs = JSON.parse(raw);
          const key = `${userId}_${courseId}`;
          subs[key] = {
            courseId,
            userId,
            isActive: isSubActive,
            status: isSubActive ? 'active' : 'pending_review',
            expiresAt: data.subscription?.expires_at,
            enrolledAt: new Date().toISOString(),
          };
          if (payload.user_email) {
            subs[`${payload.user_email.toLowerCase()}_${courseId}`] = subs[key];
          }
          localStorage.setItem('tarqa_course_subscriptions', JSON.stringify(subs));
        } catch {}

        window.dispatchEvent(
          new CustomEvent('tarqa_course_subscription_updated', {
            detail: { courseId, userId, isActive: isSubActive },
          })
        );

        return {
          success: true,
          receipt: data.receipt,
          whatsapp_url: data.whatsapp_url,
          message: data.message || 'تم تفعيل اشتراك الدورة وتوليد الإيصال بنجاح!',
        };
      }

      return {
        success: false,
        message: data.error || 'تعذر تأكيد عملية الدفع',
      };
    } catch (e: any) {
      return {
        success: false,
        message: e.message || 'خطأ في الاتصال بالخادم',
      };
    }
  },

  /**
   * فحص ما إذا كان الطالب مشتركاً في دورة محددة
   */
  isUserSubscribedToCourse(user: TarqaUser | null | undefined, courseId: string): boolean {
    if (!user) return false;
    // المشرفون والمدراء يدخلون كل الدورات
    if (['admin', 'super_admin', 'editor', 'owner', 'E.CMS'].includes(user.role as any)) {
      return true;
    }

    // 1. فحص اشتراكات الدورات المستقلة في التخزين المحلي وقاعدة البيانات
    try {
      const raw = localStorage.getItem('tarqa_course_subscriptions');
      if (raw) {
        const subs = JSON.parse(raw);
        const uId = (user.id || '').toLowerCase().trim();
        const uEmail = (user.email || '').toLowerCase().trim();
        const cId = courseId.toLowerCase().trim();

        const candidateKeys = [
          `${user.id}_${courseId}`,
          `${courseId}_${user.id}`,
          `${uId}_${cId}`,
          `${cId}_${uId}`,
          uEmail ? `${uEmail}_${cId}` : null,
          uEmail ? `${cId}_${uEmail}` : null,
          uEmail ? `${uEmail}_${courseId}` : null,
          uEmail ? `${courseId}_${uEmail}` : null,
        ].filter(Boolean) as string[];

        for (const k of candidateKeys) {
          const sub = subs[k];
          if (sub) {
            // إذا كان الاشتراك ملغياً أو غير مفعل
            if (
              sub.isActive === false ||
              sub.active === false ||
              sub.status === 'cancelled' ||
              sub.status === 'pending_review' ||
              Number(sub.is_active) === 0
            ) {
              return false;
            }
            if (
              sub.isActive === true ||
              sub.active === true ||
              sub.status === 'active' ||
              Number(sub.is_active) === 1
            ) {
              if (!sub.expiresAt) return true;
              if (new Date(sub.expiresAt).getTime() > Date.now()) return true;
              return false;
            }
          }
        }
      }
    } catch {}

    // 2. إذا كانت دورة التأسيس الأساسية وكان المستخدم مشتركاً سابقاً في باقة الموقع الشاملة
    if (courseId === 'course-foundation' && user.isSubscribed) {
      if (!user.subscriptionExpiresAt) return true;
      if (new Date(user.subscriptionExpiresAt).getTime() > Date.now()) return true;
    }

    return false;
  },

  /**
   * مزامنة اشتراكات الدورات مباشرة من قاعدة بيانات MySQL المركزية
   */
  async syncCourseSubscriptionsFromDb(userId?: string, userEmail?: string): Promise<Record<string, any>> {
    try {
      const res = await fetch('/api/hostinger_api.php?action=get_course_subscriptions');
      if (res.ok) {
        const data = await res.json();
        if (data && data.success && Array.isArray(data.subscriptions)) {
          const raw = localStorage.getItem('tarqa_course_subscriptions') || '{}';
          const localSubs = JSON.parse(raw);
          const updatedSubs: Record<string, any> = { ...localSubs };

          for (const sub of data.subscriptions) {
            const isActive = Number(sub.is_active) === 1 && (!sub.expires_at || new Date(sub.expires_at).getTime() > Date.now());
            const key1 = `${sub.user_id}_${sub.course_id}`;
            const subData = {
              courseId: sub.course_id,
              userId: sub.user_id,
              userEmail: sub.user_email,
              isActive,
              status: isActive ? 'active' : 'cancelled',
              expiresAt: sub.expires_at,
              startsAt: sub.starts_at,
              orderId: sub.order_id,
              promoCode: sub.promo_code,
              amountPaid: sub.amount_paid,
            };
            updatedSubs[key1] = subData;
            if (sub.user_email) {
              updatedSubs[`${sub.user_email.toLowerCase()}_${sub.course_id}`] = subData;
            }
          }
          localStorage.setItem('tarqa_course_subscriptions', JSON.stringify(updatedSubs));
          return updatedSubs;
        }
      }
    } catch (e) {
      console.warn('[Commerce] syncCourseSubscriptionsFromDb error:', e);
    }
    return {};
  },

  // ----------------------------------------------------------------------------
  // 4. سجل الفواتير والإيصالات وإعدادات الواتساب
  // ----------------------------------------------------------------------------
  async getPaymentReceipts(): Promise<PaymentReceipt[]> {
    try {
      const res = await fetch('/api/hostinger_api.php?action=get_payment_receipts');
      if (res.ok) {
        const data = await res.json();
        if (data && data.success && Array.isArray(data.receipts)) {
          return data.receipts;
        }
      }
    } catch (e) {
      console.warn('[Commerce] getPaymentReceipts error:', e);
    }
    return [];
  },

  async getReceiptSettings(): Promise<ReceiptSettings> {
    try {
      const res = await fetch('/api/hostinger_api.php?action=get_receipt_settings');
      if (res.ok) {
        const data = await res.json();
        if (data && data.success && data.settings) {
          return data.settings;
        }
      }
    } catch {}
    return { admin_whatsapp: '966500000000', admin_email: 'tarqa.qudurat@gmail.com' };
  },

  async saveReceiptSettings(settings: ReceiptSettings): Promise<boolean> {
    try {
      const res = await fetch('/api/hostinger_api.php?action=save_receipt_settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      return Boolean(data && data.success);
    } catch {
      return false;
    }
  },
};

