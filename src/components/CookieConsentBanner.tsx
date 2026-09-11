import React, { useState, useEffect } from 'react';
import { Cookie, Check, Shield, X, ExternalLink } from 'lucide-react';
import { PolicyTab } from './LegalPoliciesModal';

interface CookieConsentBannerProps {
  onOpenPolicies: (tab: PolicyTab) => void;
}

export const CookieConsentBanner: React.FC<CookieConsentBannerProps> = ({ onOpenPolicies }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    try {
      const consent = localStorage.getItem('tarqa_cookie_consent');
      if (!consent) {
        // تأخير ظهور بسيط لإعطاء تجربة مستخدم سلسة بعد تحميل الصفحة
        const timer = setTimeout(() => {
          setIsVisible(true);
        }, 1200);
        return () => clearTimeout(timer);
      }
    } catch (e) {
      console.warn('LocalStorage error reading cookie consent:', e);
    }
  }, []);

  const handleAcceptAll = () => {
    try {
      localStorage.setItem('tarqa_cookie_consent', 'all');
      localStorage.setItem('tarqa_cookie_consent_date', new Date().toISOString());
    } catch (e) {}
    setIsVisible(false);
  };

  const handleAcceptEssential = () => {
    try {
      localStorage.setItem('tarqa_cookie_consent', 'essential');
      localStorage.setItem('tarqa_cookie_consent_date', new Date().toISOString());
    } catch (e) {}
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-40 w-[94%] max-w-2xl animate-in fade-in slide-in-from-bottom-6 duration-300">
      <div className="p-4 sm:p-5 rounded-3xl bg-white/95 dark:bg-[#0a0f1d]/95 backdrop-blur-xl border border-amber-500/30 shadow-2xl shadow-black/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        
        <div className="flex items-start gap-3.5 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-500 flex items-center justify-center shrink-0 mt-0.5 relative">
            <Cookie className="w-5 h-5 animate-pulse" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
          </div>

          <div className="space-y-1 min-w-0">
            <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5">
              <span>نحن نحترم خصوصيتك ونستخدم الكوكيز 🍪</span>
            </h4>
            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              نستخدم ملفات تعريف الارتباط والتخزين المحلي لحفظ تقدمك في الاختبارات بدون انقطاع، تأمين جلسة حسابك، وتحسين تجربة الشرح بالفيديو.
            </p>
            <div className="flex items-center gap-3 pt-0.5 text-[11px]">
              <button
                type="button"
                onClick={() => onOpenPolicies('cookies')}
                className="text-amber-500 hover:underline font-bold inline-flex items-center gap-1 cursor-pointer"
              >
                <span>سياسة الكوكيز</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </button>
              <span className="text-slate-400">•</span>
              <button
                type="button"
                onClick={() => onOpenPolicies('privacy')}
                className="text-slate-500 dark:text-slate-400 hover:text-amber-500 hover:underline cursor-pointer"
              >
                سياسة الخصوصية
              </button>
            </div>
          </div>
        </div>

        {/* أزرار الموافقة والخيارات */}
        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 pt-1 sm:pt-0">
          <button
            type="button"
            onClick={handleAcceptEssential}
            className="flex-1 sm:flex-none px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs transition cursor-pointer"
            title="قبول الملفات الأساسية فقط لتشغيل الموقع"
          >
            الضرورية فقط
          </button>

          <button
            type="button"
            onClick={handleAcceptAll}
            className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition shadow-md shadow-amber-500/20 active:scale-95 cursor-pointer flex items-center justify-center gap-1"
          >
            <Check className="w-3.5 h-3.5" />
            <span>قبول الكل</span>
          </button>

          <button
            type="button"
            onClick={handleAcceptEssential}
            className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition sm:hidden"
            title="إغلاق"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

      </div>
    </div>
  );
};
