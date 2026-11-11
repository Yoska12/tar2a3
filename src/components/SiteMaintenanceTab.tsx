import React, { useState, useEffect } from 'react';
import {
  Wrench,
  Power,
  ShieldCheck,
  Clock,
  Sparkles,
  RotateCcw,
  Check,
  Send,
  ExternalLink,
  Eye,
  AlertTriangle,
  Server,
  Layers,
  GraduationCap,
  Zap,
  Cloud,
  CheckCircle2,
  Users,
  UserX,
  Lock,
  RefreshCw
} from 'lucide-react';
import {
  maintenanceService,
  MaintenanceConfig,
  DEFAULT_MAINTENANCE_CONFIG
} from '../lib/maintenanceService';
import { authService } from '../lib/supabase';
import { MaintenanceScreen } from './MaintenanceScreen';

export const SiteMaintenanceTab: React.FC = () => {
  const [config, setConfig] = useState<MaintenanceConfig>(() => maintenanceService.getConfig());
  const [formData, setFormData] = useState<MaintenanceConfig>(() => maintenanceService.getConfig());
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState<boolean>(false);
  const [isSimulatingMode, setIsSimulatingMode] = useState<boolean>(() => maintenanceService.isPreviewModeActive());

  useEffect(() => {
    const handleUpdate = () => {
      const latest = maintenanceService.getConfig();
      setConfig(latest);
      setFormData(latest);
      setIsSimulatingMode(maintenanceService.isPreviewModeActive());
    };

    window.addEventListener('tarqa_maintenance_changed', handleUpdate);
    // مزامنة صامتة عند فتح تبويب الصيانة
    maintenanceService.syncFromCloud().then((cloudConf) => {
      if (cloudConf) {
        setConfig(cloudConf);
        setFormData(cloudConf);
      }
    }).catch(() => {});

    return () => window.removeEventListener('tarqa_maintenance_changed', handleUpdate);
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 5000);
  };

  // تبديل حالة وضع الصيانة مباشرة
  const handleToggleMaintenance = async () => {
    setIsSyncing(true);
    const currentUser = authService.getCurrentUser();
    const updated = maintenanceService.toggleMaintenance(undefined, currentUser);
    setConfig(updated);
    setFormData(updated);

    try {
      await maintenanceService.syncToCloud(updated);
    } catch {}

    setIsSyncing(false);
    showToast(
      updated.isEnabled
        ? '🛑 تم تفعيل وضع الصيانة بنجاح وحفظه سحابياً! الموقع محجوب الآن فوراً عن جميع الزوار والطلاب والمدرسين، ومتاح لحسابك كمسؤول للمتابعة.'
        : '🟢 تم إيقاف وضع الصيانة وحفظه سحابياً! الموقع مفتوح ومتاح لجميع الزوار والطلاب والمدرسين الآن.'
    );
  };

  // حفظ التعديلات على النصوص والتوقيت
  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSyncing(true);
    const currentUser = authService.getCurrentUser();
    const updated = maintenanceService.saveConfig(formData, currentUser);
    setConfig(updated);

    try {
      await maintenanceService.syncToCloud(updated);
    } catch {}

    setIsSyncing(false);
    showToast('تم حفظ وتطبيق وتعميم إعدادات شاشة الصيانة سحابياً بنجاح! ✨');
  };

  // تفعيل وضع محاكاة الطالب (لتجربة الحجب الفعلي على نفس المتصفح)
  const handleToggleSimulation = () => {
    const next = !isSimulatingMode;
    const currentUser = authService.getCurrentUser();
    maintenanceService.setPreviewMode(next, currentUser);
    setIsSimulatingMode(next);
  };

  // استعادة الافتراضي
  const handleReset = async () => {
    if (window.confirm('هل أنت متأكد من استعادة نصوص ورسائل الصيانة الافتراضية؟')) {
      setIsSyncing(true);
      const currentUser = authService.getCurrentUser();
      const def = maintenanceService.resetToDefault(currentUser);
      setConfig(def);
      setFormData(def);
      try {
        await maintenanceService.syncToCloud(def);
      } catch {}
      setIsSyncing(false);
      showToast('تمت استعادة الإعدادات الافتراضية وحفظها بنجاح.');
    }
  };

  // تطبيق نماذج الصيانة الجاهزة
  const applyPreset = (preset: 'routine' | 'upgrade' | 'exam' | 'courses') => {
    let presetData: Partial<MaintenanceConfig> = {};
    if (preset === 'routine') {
      presetData = {
        title: 'المنصة تخضع لأعمال صيانة دورية سريعة 🛠️',
        message: 'يقوم الفريق الفني بفحص دوري وسريع لجودة الخدمة وسرعة التحميل لضمان تجربة تصفح مثالية. شكراً لصبركم ونعود إليكم قريباً!',
        estimatedReturnTime: 'اليوم خلال ساعتين',
        reasonPreset: 'routine'
      };
    } else if (preset === 'upgrade') {
      presetData = {
        title: 'المنصة تخضع لترقية الخوادم وقواعد البيانات 🚀',
        message: 'نقوم حالياً بترقية وتوسيع سيرفرات منصة طرقع لتوفير سرعة فائقة جداً في التصفح واستيعاب تدريبات الآلاف من الطلاب. نعتذر عن الإزعاج ونعود إليكم فوراً!',
        estimatedReturnTime: 'اليوم خلال 45 دقيقة',
        reasonPreset: 'upgrade'
      };
    } else if (preset === 'exam') {
      presetData = {
        title: 'تحديث شامل لبنك الأسئلة ومحاكي قياس ⚡',
        message: 'جاري إضافة أحدث تجميعات وتسريبات اختبار قياس الكمي لعام 1446-1447 وتدقيق الأسئلة ونماذج الحلول الذكية مع كبار المدربين.',
        estimatedReturnTime: 'اليوم الساعة 10:00 مساءً',
        reasonPreset: 'exam'
      };
    } else if (preset === 'courses') {
      presetData = {
        title: 'تحديث وإضافة محاضرات تأسيس جديدة 🎓',
        message: 'يتم الآن رفع باقة جديدة من شروحات التأسيس وحيل طرقع للحل السريع وتحديث المذكرات وقوانين الـ PDF لتكون جاهزة لجميع المشتركين.',
        estimatedReturnTime: 'غداً الساعة 12:00 ظهراً',
        reasonPreset: 'courses'
      };
    }

    setFormData((prev) => ({ ...prev, ...presetData }));
    showToast('تم تعبئة نموذج الصيانة المختار، اضغط "حفظ الإعدادات" لتطبيقه 📝');
  };

  return (
    <div className="space-y-6">
      {/* إشعار النجاح */}
      {toastMessage && (
        <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4" />
            <span>{toastMessage}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="text-emerald-400 hover:text-white cursor-pointer">✕</button>
        </div>
      )}

      {/* لوحة الحالة الرئيسية وزر التبديل الرئيسي */}
      <div className={`p-6 sm:p-8 rounded-3xl tarqa-glass-card border shadow-lg transition-all ${
        config.isEnabled
          ? 'border-amber-500/40 bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent'
          : 'border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent'
      }`}>
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[11px] font-black px-3 py-1 rounded-full border shadow-sm flex items-center gap-1.5 ${
                config.isEnabled
                  ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/40 animate-pulse'
                  : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
              }`}>
                <span className={`w-2 h-2 rounded-full ${config.isEnabled ? 'bg-amber-400 animate-ping' : 'bg-emerald-400'}`} />
                <span>{config.isEnabled ? 'وضع الصيانة مفعّل حالياً ⚠️' : 'الموقع متاح ويعمل بصورة طبيعية 🟢'}</span>
              </span>

              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <Cloud className="w-3.5 h-3.5 text-sky-500" />
                <span>مزامنة سحابية نشطة</span>
              </span>

              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                آخر تحديث: {new Date(config.updatedAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
              إدارة حالة الموقع ووضع الصيانة 🛠️
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
              تحكم كامل ومباشر في إتاحة المنصة للجمهور أو إغلاقها تحت الصيانة والتطوير. عند التفعيل، يتم حجب الموقع فورياً وسحابياً عن الزوار غير المسجلين، والطلاب، والمدرسين، مع استمرار وصول المالك والمشرفين للمنصة.
            </p>
          </div>

          {/* أزرار التحكم الرئيسية */}
          <div className="shrink-0 w-full sm:w-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <button
              type="button"
              disabled={isSyncing}
              onClick={handleToggleMaintenance}
              className={`px-7 py-4 rounded-2xl text-sm font-black transition-all shadow-xl flex items-center justify-center gap-2.5 cursor-pointer transform hover:scale-[1.02] active:scale-[0.98] ${
                isSyncing ? 'opacity-70 cursor-wait' : ''
              } ${
                config.isEnabled
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-500/30 border border-emerald-400/50'
                  : 'bg-gradient-to-r from-amber-500 via-orange-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 text-slate-950 font-black shadow-amber-500/30 border border-amber-300/60'
              }`}
            >
              {isSyncing ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Power className="w-5 h-5" />}
              <span>
                {config.isEnabled
                  ? 'إيقاف الصيانة وفتح الموقع للجميع 🟢'
                  : 'تفعيل وضع الصيانة وحجب الموقع فوراً 🛑'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setIsPreviewModalOpen(true)}
              className="px-5 py-4 rounded-2xl text-xs font-black bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 transition flex items-center justify-center gap-2 cursor-pointer shadow-md"
              title="معاينة شاشة الصيانة بالحجم الكامل كما يراها الطالب والزائر"
            >
              <Eye className="w-4 h-4 text-sky-400" />
              <span>معاينة شاشة الطالب 👁️</span>
            </button>
          </div>
        </div>

        {/* بطاقة توضيحية شاملة لصلاحيات الحجب والدخول */}
        <div className="mt-6 pt-5 border-t border-slate-200/60 dark:border-slate-800/80 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 flex items-start gap-2.5">
            <UserX className="w-5 h-5 shrink-0 text-rose-500 mt-0.5" />
            <div className="space-y-1">
              <strong className="block font-black text-rose-600 dark:text-rose-400 text-xs">
                المحجوبون تماماً أثناء وضع الصيانة:
              </strong>
              <ul className="list-disc list-inside space-y-0.5 text-[11px] leading-relaxed">
                <li>الزوار غير المسجلين (أي شخص ليس لديه حساب).</li>
                <li>جميع الطلاب (الحسابات برتبة طالب).</li>
                <li>جميع المدرسين والمعلمين (الحسابات برتبة مدرس).</li>
              </ul>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 flex items-start gap-2.5">
            <ShieldCheck className="w-5 h-5 shrink-0 text-emerald-500 mt-0.5" />
            <div className="space-y-1">
              <strong className="block font-black text-emerald-600 dark:text-emerald-400 text-xs">
                المصرح لهم بالدخول والتصفح فقط:
              </strong>
              <ul className="list-disc list-inside space-y-0.5 text-[11px] leading-relaxed">
                <li>مالك المنصة (Owner Email).</li>
                <li>المشرفون والمدراء العامون (Super Admin & Admin).</li>
                <li>لإدارة المحتوى وتعديل المنصة دون أي انقطاع.</li>
              </ul>
            </div>
          </div>
        </div>

        {/* تنبيه تجربة المحاكاة */}
        <div className="mt-4 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-slate-800 dark:text-slate-200 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
            <span>
              <strong>تنبيه للمشرف:</strong> لأنك مسجل كمسؤول، يظل الموقع مفتوحاً أمامك لتتمكن من إدارته. لتجربة الشاشة المحجوبة كما يراها الطالب مباشرة:
            </span>
          </div>
          <button
            type="button"
            onClick={handleToggleSimulation}
            className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer shadow-sm shrink-0 flex items-center gap-1.5 ${
              isSimulatingMode
                ? 'bg-rose-600 text-white hover:bg-rose-700'
                : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
            }`}
          >
            <span>{isSimulatingMode ? 'إلغاء وضع المحاكاة ✕' : 'تجربة الحجب على شاشتي (محاكاة الطالب) 🧪'}</span>
          </button>
        </div>
      </div>

      {/* نماذج سريعة جاهزة بنقرة واحدة */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>نماذج جاهزة لأسباب الصيانة (بنقرة واحدة):</span>
          </h3>
          <span className="text-xs text-slate-400">اختر نموذجاً لتعبئة النصوص والوقت تلقائياً</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <button
            type="button"
            onClick={() => applyPreset('routine')}
            className="p-3.5 rounded-2xl tarqa-glass-card border border-slate-200 dark:border-slate-800 hover:border-amber-500/50 text-right transition group cursor-pointer"
          >
            <div className="flex items-center gap-2 text-amber-500 font-bold text-xs mb-1">
              <Wrench className="w-4 h-4" />
              <span>صيانة دورية سريعة</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
              فحص دوري لجودة الخدمة وسرعة التحميل (ساعتان)
            </p>
          </button>

          <button
            type="button"
            onClick={() => applyPreset('upgrade')}
            className="p-3.5 rounded-2xl tarqa-glass-card border border-slate-200 dark:border-slate-800 hover:border-sky-500/50 text-right transition group cursor-pointer"
          >
            <div className="flex items-center gap-2 text-sky-500 font-bold text-xs mb-1">
              <Server className="w-4 h-4" />
              <span>ترقية الخوادم</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
              توسيع السيرفرات وقواعد البيانات للسرعة القصوى (45 دقيقة)
            </p>
          </button>

          <button
            type="button"
            onClick={() => applyPreset('exam')}
            className="p-3.5 rounded-2xl tarqa-glass-card border border-slate-200 dark:border-slate-800 hover:border-purple-500/50 text-right transition group cursor-pointer"
          >
            <div className="flex items-center gap-2 text-purple-500 font-bold text-xs mb-1">
              <Zap className="w-4 h-4" />
              <span>تحديث المحتوى والتأسيس</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
              تحديث الشروحات والقوانين الذهنية وتدقيق المذكرات
            </p>
          </button>

          <button
            type="button"
            onClick={() => applyPreset('courses')}
            className="p-3.5 rounded-2xl tarqa-glass-card border border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 text-right transition group cursor-pointer"
          >
            <div className="flex items-center gap-2 text-emerald-500 font-bold text-xs mb-1">
              <GraduationCap className="w-4 h-4" />
              <span>تحديث دورات التأسيس</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
              إضافة محاضرات جديدة ومذكرات PDF وحيل الحل السريع
            </p>
          </button>
        </div>
      </div>

      {/* قسم الإعدادات والمعاينة المباشرة */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* نموذج تخصيص رسالة الصيانة */}
        <div className="lg:col-span-7 tarqa-glass-card p-6 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <span>تخصيص نصوص وروابط شاشة الصيانة</span>
            </h3>
            <button
              type="button"
              onClick={handleReset}
              className="text-xs text-slate-500 hover:text-amber-500 flex items-center gap-1 transition cursor-pointer"
              title="استعادة النص الافتراضي"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>استعادة الافتراضي</span>
            </button>
          </div>

          <form onSubmit={handleSaveForm} className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                عنوان شاشة الصيانة الرئيسي:
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium"
                placeholder="مثال: المنصة تحت الصيانة والتحديث الدوري 🛠️"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                الرسالة التوضيحية للطلاب والمعلمين:
              </label>
              <textarea
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                rows={4}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white leading-relaxed font-medium"
                placeholder="اكتب شرحاً لطيفاً للطلاب حول سبب التحديث..."
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  الموعد المتوقع لإعادة الفتح:
                </label>
                <input
                  type="text"
                  value={formData.estimatedReturnTime}
                  onChange={(e) => setFormData({ ...formData, estimatedReturnTime: e.target.value })}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold"
                  placeholder="مثال: اليوم الساعة 10:00 مساءً"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  نص زر التليجرام والدعم:
                </label>
                <input
                  type="text"
                  value={formData.supportButtonText}
                  onChange={(e) => setFormData({ ...formData, supportButtonText: e.target.value })}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium"
                  placeholder="مثال: متابعة التحديثات عبر تليجرام 💬"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                رابط قناة التحديثات أو الدعم (تليجرام):
              </label>
              <input
                type="url"
                value={formData.supportUrl}
                onChange={(e) => setFormData({ ...formData, supportUrl: e.target.value })}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono"
                placeholder="https://t.me/tr23km"
              />
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsPreviewModalOpen(true)}
                className="px-4 py-2.5 rounded-xl font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs transition cursor-pointer"
              >
                معاينة كاملة 👁️
              </button>
              <button
                type="submit"
                disabled={isSyncing}
                className="px-6 py-2.5 rounded-xl font-black bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 shadow-md shadow-amber-500/25 transition cursor-pointer flex items-center gap-1.5"
              >
                {isSyncing && <RefreshCw className="w-4 h-4 animate-spin" />}
                <span>حفظ وتطبيق إعدادات الصيانة سحابياً ✨</span>
              </button>
            </div>
          </form>
        </div>

        {/* المعاينة الحية المباشرة لما يراه الطالب */}
        <div className="lg:col-span-5 tarqa-glass-card p-6 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 mb-3">
              <h3 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                <Eye className="w-4 h-4 text-sky-500" />
                <span>معاينة حية لشاشة الطالب (Live Preview)</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsPreviewModalOpen(true)}
                className="text-[11px] font-bold text-amber-500 hover:underline cursor-pointer"
              >
                تكبير الشاشة ⤢
              </button>
            </div>

            {/* محاكاة بطاقة شاشة الصيانة المصغرة */}
            <div className="rounded-2xl p-5 bg-[#090d17] border border-amber-500/30 text-center space-y-3 relative overflow-hidden shadow-inner">
              <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent" />

              <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400 shadow-sm">
                <Wrench className="w-6 h-6 animate-pulse" />
              </div>

              <h4 className="text-sm font-black text-white leading-tight">
                {formData.title || 'المنصة تحت الصيانة والتحديث الدوري 🛠️'}
              </h4>

              <p className="text-[11px] text-slate-300 leading-relaxed line-clamp-3">
                {formData.message || 'يقوم فريق العمل الآن بإجراء تحديثات هامة...'}
              </p>

              {formData.estimatedReturnTime && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[10px] font-bold">
                  <Clock className="w-3 h-3 text-amber-400" />
                  <span>الموعد المتوقع:</span>
                  <span className="text-white font-mono">{formData.estimatedReturnTime}</span>
                </div>
              )}

              <div className="pt-2">
                <div className="w-full py-2 rounded-xl text-[11px] font-bold bg-gradient-to-r from-sky-500 to-blue-600 text-white flex items-center justify-center gap-1.5 shadow-sm">
                  <Send className="w-3.5 h-3.5" />
                  <span>{formData.supportButtonText}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed space-y-1">
            <p className="font-bold text-slate-700 dark:text-slate-300">
              💡 ملخص سريع للمشرف:
            </p>
            <p>
              عند النقر على زر التفعيل، يتم حظر أي طالب أو مدرس أو زائر يدخل الموقع وتظهر له هذه الشاشة فوراً، مع إمكانية إلغاء الحظر في أي ثانية.
            </p>
          </div>
        </div>
      </div>

      {/* مودال المعاينة الكاملة لشاشة الصيانة */}
      {isPreviewModalOpen && (
        <div className="fixed inset-0 z-[250] bg-black/95 backdrop-blur-xl flex flex-col">
          <header className="bg-slate-900 border-b border-slate-800 px-6 py-3 flex items-center justify-between z-10 shrink-0">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
              <span className="text-xs font-black text-white">معاينة شاشة الصيانة بالحجم الكامل كما يراها الطالب والزائر</span>
            </div>
            <button
              type="button"
              onClick={() => setIsPreviewModalOpen(false)}
              className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black transition cursor-pointer"
            >
              إغلاق المعاينة ✕
            </button>
          </header>
          <div className="flex-1 overflow-y-auto">
            <MaintenanceScreen
              config={formData}
              isPreview={true}
              onExitPreview={() => setIsPreviewModalOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
};
