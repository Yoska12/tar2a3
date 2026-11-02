import React from 'react';
import {
  Wrench,
  Clock,
  Sparkles,
  ExternalLink,
  RotateCcw,
  ShieldCheck,
  Send,
  Zap,
  Lock
} from 'lucide-react';
import { MaintenanceConfig, DEFAULT_MAINTENANCE_CONFIG, maintenanceService } from '../lib/maintenanceService';
import { TarqaUser, isOwnerEmail } from '../lib/supabase';

interface MaintenanceScreenProps {
  config?: MaintenanceConfig;
  currentUser?: TarqaUser | null;
  onAdminLoginClick?: () => void;
  onEnterDashboard?: () => void;
  onDisableMaintenance?: () => void;
  isPreview?: boolean;
  onExitPreview?: () => void;
}

export const MaintenanceScreen: React.FC<MaintenanceScreenProps> = ({
  config = DEFAULT_MAINTENANCE_CONFIG,
  currentUser,
  onAdminLoginClick,
  onEnterDashboard,
  onDisableMaintenance,
  isPreview,
  onExitPreview
}) => {
  const isSimulating = isPreview ?? maintenanceService.isPreviewModeActive();
  const isAdmin = Boolean(
    currentUser && (
      isOwnerEmail(currentUser.email) ||
      currentUser.role === 'admin' ||
      currentUser.role === 'super_admin'
    )
  );

  const handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  return (
    <div
      dir="rtl"
      className="min-h-screen w-full bg-[#07090e] text-slate-100 flex flex-col justify-between items-center p-3 sm:p-6 md:p-10 relative overflow-y-auto overflow-x-hidden selection:bg-amber-500 selection:text-slate-950 font-sans"
    >
      {/* خلفية جمالية خفيفة وسريعة لا تسبب تجميد أو تعليق للأجهزة الضعيفة والموبايل */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-gradient-to-b from-amber-500/15 via-orange-500/5 to-transparent blur-2xl rounded-full opacity-60 pointer-events-none" />
        <div className="absolute -bottom-32 left-1/4 w-[400px] h-[400px] bg-gradient-to-t from-sky-500/10 via-blue-500/5 to-transparent blur-2xl rounded-full opacity-40 pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(rgba(245,158,11,0.04)_1px,transparent_1px)] [background-size:24px_24px] opacity-40" />
      </div>

      {/* الرأس: شعار طرقع */}
      <header className="relative z-10 w-full max-w-4xl flex items-center justify-between py-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-amber-500/25 border border-amber-300/40">
            <Zap className="w-5 h-5 fill-current" />
          </div>
          <div>
            <span className="text-lg font-black text-white tracking-tight flex items-center gap-1.5">
              <span>طَرقَعْ</span>
              <span className="text-amber-400">TARQA3</span>
            </span>
            <span className="block text-[10px] text-slate-400 font-medium">
              المنصة الذكية لتأسيس وتفوق القدرات الكمي
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black bg-amber-500/15 text-amber-400 border border-amber-500/30 shadow-sm animate-pulse">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            <span>أعمال تطوير دوري</span>
          </span>
        </div>
      </header>

      {/* جسم الصفحة المركزي: بطاقة الصيانة الزجاجية */}
      <main className="relative z-10 w-full max-w-2xl my-auto py-8">
        {/* بطاقة تحكم الإدارة والمشرفين (تظهر حصراً للمسؤول والمالك لتأكيد أن وضع الصيانة شغال على كل الأجهزة مع إمكانية الدخول للإشراف) */}
        {isAdmin && !isSimulating && (
          <div className="mb-6 rounded-3xl bg-gradient-to-r from-amber-500/20 via-orange-500/15 to-amber-500/20 border-2 border-amber-500/70 p-4 sm:p-5 text-right shadow-2xl shadow-amber-500/20 backdrop-blur-xl animate-in fade-in slide-in-from-top-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/30 border border-amber-400/50 flex items-center justify-center text-amber-300 shrink-0 shadow-md">
                  <ShieldCheck className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                    <span className="text-sm font-black text-white">
                      أهلاً بك يا أدمن ({currentUser?.fullName || currentUser?.email}) 👑
                    </span>
                  </div>
                  <p className="text-[11px] sm:text-xs text-amber-300/90 font-medium mt-0.5">
                    وضع الصيانة شغال وفعّال الآن على جميع الأجهزة في العالم (اللابتوب والموبايل والتابلت).
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    maintenanceService.setAdminOverride(true);
                    onEnterDashboard?.();
                  }}
                  className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs transition cursor-pointer shadow-md active:scale-95 flex items-center justify-center gap-1.5"
                  title="الدخول للوحة التحكم والموقع للإشراف والمتابعة"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>لوحة التحكم ⚙️</span>
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    if (window.confirm('هل أنت متأكد من إيقاف وضع الصيانة وفتح المنصة فوراً لجميع الطلاب والزوار؟')) {
                      const updated = maintenanceService.toggleMaintenance(false, currentUser);
                      await maintenanceService.syncToCloud(updated);
                      onDisableMaintenance?.();
                    }
                  }}
                  className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs transition cursor-pointer shadow-md active:scale-95 flex items-center justify-center gap-1.5"
                  title="إنهاء وضع الصيانة وفتح الموقع للجميع فوراً"
                >
                  <span>إيقاف الصيانة 🟢</span>
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="tarqa-glass-card rounded-3xl p-6 sm:p-10 border border-amber-500/30 bg-[#0c101c]/80 backdrop-blur-2xl shadow-2xl shadow-amber-500/10 text-center space-y-6 relative overflow-hidden">
          {/* خط علوي متوهج */}
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-amber-400 to-transparent" />

          {/* أيقونة الصيانة المركزية مع تأثيرات حركية */}
          <div className="relative inline-flex items-center justify-center">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-gradient-to-br from-amber-500/20 via-orange-500/15 to-transparent border border-amber-400/40 shadow-inner flex items-center justify-center text-amber-400 relative">
              <Wrench className="w-12 h-12 sm:w-14 sm:h-14 animate-pulse drop-shadow-[0_0_15px_rgba(245,158,11,0.5)]" />
              <div className="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center font-bold text-xs shadow-md">
                <Sparkles className="w-4 h-4 fill-current" />
              </div>
            </div>
          </div>

          {/* العنوان الرئيسي */}
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-black text-white leading-tight tracking-tight">
              {config.title || 'المنصة تحت الصيانة والتحديث الدوري 🛠️'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-normal max-w-lg mx-auto">
              {config.message ||
                'يقوم فريق العمل الآن بإجراء ترقيات وتحديثات مهمة على النظام لضمان أعلى مستوى من السرعة والاستقرار لجميع الطلاب والمدرسين. سنعود للعمل قريباً جداً!'}
            </p>
          </div>

          {/* بطاقة التوقيت المتوقع */}
          {config.estimatedReturnTime && (
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs sm:text-sm font-bold shadow-sm">
              <Clock className="w-4 h-4 text-amber-400 shrink-0" />
              <span>الموعد المتوقع للعودة:</span>
              <span className="text-white font-mono font-black">{config.estimatedReturnTime}</span>
            </div>
          )}

          {/* أزرار الإجراءات */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            {config.supportUrl && (
              <a
                href={config.supportUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto px-6 py-3 rounded-2xl font-black text-xs sm:text-sm bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white shadow-lg shadow-sky-500/25 transition-all flex items-center justify-center gap-2 group cursor-pointer"
              >
                <Send className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                <span>{config.supportButtonText || 'متابعة التحديثات عبر تليجرام 💬'}</span>
                <ExternalLink className="w-3.5 h-3.5 opacity-70" />
              </a>
            )}

            <button
              type="button"
              onClick={handleReload}
              className="w-full sm:w-auto px-5 py-3 rounded-2xl font-bold text-xs sm:text-sm bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border border-slate-700/80 hover:border-slate-600 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4 text-amber-400" />
              <span>إعادة التحقق وتحديث الصفحة</span>
            </button>
          </div>

          {/* شريط الإشعار للطلاب والمدرسين */}
          <div className="pt-4 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span>حساباتكم واشتراكاتكم وتقدمكم في المحاضرات محفوظة بالكامل وبأمان تام 🛡️</span>
          </div>
        </div>
      </main>

      {/* الفوتر: مدخل المشرفين والإدارة وحقوق المنصة */}
      <footer className="relative z-10 w-full max-w-4xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400 py-3 border-t border-slate-800/60">
        <div>
          <span>جميع الحقوق محفوظة © {new Date().getFullYear()} منصة طرقع التعليمية</span>
        </div>

        {/* زر خاص بدخول الإدارة والمشرفين */}
        {onAdminLoginClick && (
          <button
            type="button"
            onClick={onAdminLoginClick}
            className="px-3.5 py-1.5 rounded-xl text-[11px] font-bold text-slate-400 hover:text-amber-400 hover:bg-slate-900/80 border border-transparent hover:border-amber-500/30 transition flex items-center gap-1.5 cursor-pointer"
            title="تسجيل دخول المشرفين والإدارة لمتابعة العمل وتجاوز الصيانة"
          >
            <Lock className="w-3.5 h-3.5 text-amber-500" />
            <span>تسجيل دخول المشرفين / الإدارة</span>
          </button>
        )}
      </footer>

      {/* شريط الإشعار العائم عند تفعيل وضع المعاينة والمحاكاة للمشرف */}
      {isSimulating && (
        <aside
          role="status"
          aria-label="إشعار وضع معاينة الصيانة"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] max-w-[92vw] sm:max-w-xl w-auto bg-slate-950/95 text-white border-2 border-amber-500/80 px-5 py-3 rounded-2xl shadow-2xl shadow-amber-500/20 backdrop-blur-xl flex items-center justify-between gap-4 animate-in fade-in slide-in-from-bottom-5"
        >
          <div className="flex items-center gap-2.5">
            <span className="w-3 h-3 rounded-full bg-amber-400 animate-ping shrink-0" />
            <div className="text-right">
              <p className="text-xs font-black text-amber-300">
                وضع محاكاة شاشة الطالب والزائر 👁️
              </p>
              <p className="text-[11px] text-slate-300 font-medium">
                هذه هي الشاشة المحجوبة التي تظهر للزوار والطلاب والمدرسين الآن.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              if (onExitPreview) {
                onExitPreview();
              } else {
                maintenanceService.setPreviewMode(false, currentUser);
              }
            }}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs transition cursor-pointer shadow-md shrink-0"
          >
            إنهاء المعاينة والعودة للإدارة ✕
          </button>
        </aside>
      )}
    </div>
  );
};
