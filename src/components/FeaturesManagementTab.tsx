import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Users,
  GraduationCap,
  Clock,
  Plus,
  Trash2,
  Edit2,
  ExternalLink,
  Check,
  RotateCcw,
  Eye,
  EyeOff,
  Flame,
  Zap,
  BookOpen,
  MessageSquare,
  Globe,
  Layers,
  ShieldCheck,
  BrainCircuit,
  ArrowUp,
  ArrowDown,
  Copy,
  Link,
  Compass,
  Send,
  AlertCircle
} from 'lucide-react';
import {
  PlatformFeatureItem,
  TelegramCommunityGroup,
  FeatureActionType,
  FeatureColorTheme,
  FeatureStatus,
  featuresStorage,
  DEFAULT_FEATURES,
  DEFAULT_TELEGRAM_GROUPS
} from '../lib/featuresStorage';

// قائمة الأيقونات المتاحة للاختيار بالاسم
const AVAILABLE_ICONS = [
  { id: 'GraduationCap', label: 'قبعة تخرج 🎓', icon: GraduationCap },
  { id: 'Clock', label: 'ساعة / مؤقت ⏱️', icon: Clock },
  { id: 'Users', label: 'مجتمع وطلاب 👥', icon: Users },
  { id: 'Zap', label: 'صاعقة وسرعة ⚡', icon: Zap },
  { id: 'BookOpen', label: 'كتاب ومذكرات 📖', icon: BookOpen },
  { id: 'Flame', label: 'شعلة وحماس 🔥', icon: Flame },
  { id: 'Sparkles', label: 'بريق وتميز ✨', icon: Sparkles },
  { id: 'MessageSquare', label: 'محادثة ونقاش 💬', icon: MessageSquare },
  { id: 'ShieldCheck', label: 'درع وأمان 🛡️', icon: ShieldCheck },
  { id: 'BrainCircuit', label: 'ذكاء وتحليل 🧠', icon: BrainCircuit },
  { id: 'Globe', label: 'كرة أرضية 🌐', icon: Globe },
  { id: 'Layers', label: 'طبقات ومستويات 📑', icon: Layers }
];

// قائمة الثيمات اللونية المتاحة
const AVAILABLE_THEMES: { id: FeatureColorTheme; label: string; colorClass: string; borderClass: string }[] = [
  { id: 'amber', label: 'ذهبي طرقع', colorClass: 'bg-amber-500 text-slate-950', borderClass: 'border-amber-500/50' },
  { id: 'indigo', label: 'نيلي محاكي', colorClass: 'bg-indigo-600 text-white', borderClass: 'border-indigo-500/50' },
  { id: 'sky', label: 'سماوي تليجرام', colorClass: 'bg-sky-500 text-white', borderClass: 'border-sky-500/50' },
  { id: 'emerald', label: 'زمردي متفوق', colorClass: 'bg-emerald-500 text-white', borderClass: 'border-emerald-500/50' },
  { id: 'purple', label: 'بنفسجي ملكي', colorClass: 'bg-purple-600 text-white', borderClass: 'border-purple-500/50' },
  { id: 'rose', label: 'وردي نشط', colorClass: 'bg-rose-500 text-white', borderClass: 'border-rose-500/50' }
];

// خيارات التبويبات الداخلية للموقع
const INTERNAL_TABS = [
  { id: 'courses', label: 'المحاضرات والدورات التأسيسية' },
  { id: 'dashboard', label: 'لوحة تحكم ومتابعة الطالب' },
  { id: 'speed', label: 'تحدي السرعة اليومي' },
  { id: 'leaderboard', label: 'لوحة الشرف والمتصدرين' },
  { id: 'categories', label: 'أبواب وتصنيفات القدرات' },
  { id: 'roadmap', label: 'الخريطة الذهنية للمنهج' },
  { id: 'classroom', label: 'القاعة التعليمية الذكية' }
];

export const FeaturesManagementTab: React.FC = () => {
  const [subTab, setSubTab] = useState<'features' | 'telegram'>('features');
  const [features, setFeatures] = useState<PlatformFeatureItem[]>(() => featuresStorage.getFeatures());
  const [telegramGroups, setTelegramGroups] = useState<TelegramCommunityGroup[]>(() => featuresStorage.getTelegramGroups());
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // حالة تحرير ميزة
  const [editingFeature, setEditingFeature] = useState<PlatformFeatureItem | null>(null);
  const [isFeatureModalOpen, setIsFeatureModalOpen] = useState<boolean>(false);
  const [newBulletText, setNewBulletText] = useState<string>('');

  // حالة تحرير قروب تليجرام
  const [editingGroup, setEditingGroup] = useState<TelegramCommunityGroup | null>(null);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState<boolean>(false);

  useEffect(() => {
    const handleFeaturesUpdate = () => {
      setFeatures(featuresStorage.getFeatures());
    };
    const handleGroupsUpdate = () => {
      setTelegramGroups(featuresStorage.getTelegramGroups());
    };

    window.addEventListener('tarqa_features_changed', handleFeaturesUpdate);
    window.addEventListener('tarqa_telegram_groups_changed', handleGroupsUpdate);

    return () => {
      window.removeEventListener('tarqa_features_changed', handleFeaturesUpdate);
      window.removeEventListener('tarqa_telegram_groups_changed', handleGroupsUpdate);
    };
  }, []);

  const showToast = (msg: string) => {
    setSaveSuccessMsg(msg);
    setTimeout(() => {
      setSaveSuccessMsg(null);
    }, 3500);
  };

  // فتح نموذج إضافة ميزة جديدة
  const handleAddNewFeature = () => {
    const newF: PlatformFeatureItem = {
      id: `feature-${Date.now()}`,
      title: 'ميزة جديدة',
      description: 'اكتب هنا وصفاً جذاباً يشرح أهمية هذه الميزة لطالب القدرات...',
      badge: 'جديد ✨',
      icon: 'Sparkles',
      colorTheme: 'amber',
      bullets: ['تأسيس فوري وسريع', 'شروحات استراتيجيات الحل'],
      actionType: 'courses',
      buttonText: 'تصفح الآن',
      openInNewTab: true,
      isVisible: true,
      order: features.length + 1,
      status: 'active',
      statusNotice: '',
    };
    setEditingFeature(newF);
    setIsFeatureModalOpen(true);
  };

  // حفظ الميزة
  const handleSaveFeature = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFeature) return;
    featuresStorage.saveFeature(editingFeature);
    setIsFeatureModalOpen(false);
    setEditingFeature(null);
    showToast('تم حفظ وتحديث الميزة بنجاح، التعديلات ظاهرة في الصفحة الرئيسية فوراً! ✨');
  };

  // حذف ميزة
  const handleDeleteFeature = (id: string) => {
    if (window.confirm('هل أنت متأكد من حذف هذه الميزة من الصفحة الرئيسية؟')) {
      featuresStorage.deleteFeature(id);
      showToast('تم حذف الميزة بنجاح.');
    }
  };

  // نسخ ميزة
  const handleDuplicateFeature = (id: string) => {
    featuresStorage.duplicateFeature(id);
    showToast('تم نسخ الميزة بنجاح! يمكنك الآن تعديل بيانات النسخة.');
  };

  // تحريك ترتيب الميزة
  const handleMoveFeature = (id: string, direction: 'up' | 'down') => {
    featuresStorage.moveFeature(id, direction);
  };

  // تبديل إظهار / إخفاء الميزة
  const handleToggleVisibility = (feature: PlatformFeatureItem) => {
    const updated = { ...feature, isVisible: !feature.isVisible };
    featuresStorage.saveFeature(updated);
    showToast(updated.isVisible ? 'تم إظهار الميزة في الصفحة الرئيسية.' : 'تم إخفاء الميزة.');
  };

  // تغيير سريع لحالة الميزة بنقرة واحدة (مفعلة / مغلقة مؤقتاً / قريباً)
  const handleQuickStatusChange = (feature: PlatformFeatureItem, newStatus: FeatureStatus) => {
    const badge = newStatus === 'paused'
      ? 'مغلق مؤقتاً 🔒'
      : newStatus === 'coming-soon'
      ? 'قريباً ⏳'
      : (feature.badge === 'مغلق مؤقتاً 🔒' || feature.badge === 'قريباً ⏳' ? 'متاح بالكامل ✨' : feature.badge || 'متاح بالكامل ✨');

    const updated: PlatformFeatureItem = {
      ...feature,
      status: newStatus,
      badge,
    };
    featuresStorage.saveFeature(updated);
    showToast(`تم تعيين حالة [${feature.title}] إلى: ${newStatus === 'active' ? 'مفعلة 🟢' : newStatus === 'paused' ? 'مغلقة مؤقتاً 🔒' : 'قريباً ⏳'}`);
  };

  // إضافة نقطة سريعة في النموذج
  const handleAddBullet = () => {
    if (!editingFeature || !newBulletText.trim()) return;
    setEditingFeature({
      ...editingFeature,
      bullets: [...(editingFeature.bullets || []), newBulletText.trim()]
    });
    setNewBulletText('');
  };

  // إزالة نقطة سريعة
  const handleRemoveBullet = (bIdx: number) => {
    if (!editingFeature) return;
    setEditingFeature({
      ...editingFeature,
      bullets: editingFeature.bullets.filter((_, idx) => idx !== bIdx)
    });
  };

  // فتح نموذج إضافة قروب تليجرام
  const handleAddNewGroup = () => {
    const newG: TelegramCommunityGroup = {
      id: `group-${Date.now()}`,
      name: 'قروب تليجرام جديد 💬',
      description: 'وصف لمجموعة أو قناة تليجرام.',
      url: 'https://t.me/tr23km',
      badge: 'قروب تفاعلي',
      isMain: false
    };
    setEditingGroup(newG);
    setIsGroupModalOpen(true);
  };

  // حفظ قروب تليجرام
  const handleSaveGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGroup) return;
    featuresStorage.saveTelegramGroup(editingGroup);
    setIsGroupModalOpen(false);
    setEditingGroup(null);
    showToast('تم حفظ وتحديث رابط التليجرام بنجاح! 🚀');
  };

  // حذف قروب تليجرام
  const handleDeleteGroup = (id: string) => {
    if (window.confirm('هل أنت متأكد من حذف هذا القروب/القناة؟')) {
      featuresStorage.deleteTelegramGroup(id);
      showToast('تم حذف الرابط بنجاح.');
    }
  };

  // استعادة الافتراضي
  const handleResetDefaults = () => {
    if (window.confirm('هل أنت متأكد من استعادة المميزات وروابط التليجرام الافتراضية الأصلية للمنصة؟')) {
      featuresStorage.resetToDefault();
      showToast('تم استعادة الإعدادات الافتراضية بنجاح.');
    }
  };

  // الحصول على المكون الفعلي للأيقونة
  const renderIconComponent = (iconName: string, className: string = 'w-5 h-5') => {
    const item = AVAILABLE_ICONS.find((i) => i.id === iconName);
    const Comp = item ? item.icon : Sparkles;
    return <Comp className={className} />;
  };

  return (
    <div className="space-y-6">
      {/* إشعار النجاح */}
      {saveSuccessMsg && (
        <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4" />
            <span>{saveSuccessMsg}</span>
          </div>
          <button onClick={() => setSaveSuccessMsg(null)} className="text-emerald-400 hover:text-white">✕</button>
        </div>
      )}

      {/* رأس التبويب والأزرار العلوية */}
      <div className="p-6 rounded-3xl tarqa-glass-card border border-amber-500/20 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
            تحكم كامل في المميزات والروابط
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-2">
            إدارة المميزات وروابط الموقع والتليجرام ⚙️
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            تحكم مطلق في كل بطاقة، العناوين، الأوصاف، الأيقونات، الألوان، وأنواع الروابط (دورات، محاكي، روابط خارجية، تليجرام، أو تبويبات داخلية) وتظهر التعديلات فورياً!
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition flex items-center gap-1.5 cursor-pointer"
            title="استعادة الإعدادات الافتراضية الأصلية"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>استعادة الافتراضي</span>
          </button>

          {subTab === 'features' ? (
            <button
              type="button"
              onClick={handleAddNewFeature}
              className="px-4 py-2.5 rounded-xl text-xs font-black bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 shadow-md shadow-amber-500/20 transition flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة ميزة جديدة</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleAddNewGroup}
              className="px-4 py-2.5 rounded-xl text-xs font-black bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white shadow-md shadow-sky-500/20 transition flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة رابط قروب/قناة</span>
            </button>
          )}
        </div>
      </div>

      {/* التبديل بين قسم المميزات وقسم تليجرام */}
      <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          type="button"
          onClick={() => setSubTab('features')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
            subTab === 'features'
              ? 'bg-amber-500 text-slate-950 shadow-sm font-black'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>بطاقات المميزات الرئيسية ({features.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('telegram')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
            subTab === 'telegram'
              ? 'bg-sky-500 text-white shadow-sm font-black'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>روابط وقنوات تليجرام ({telegramGroups.length})</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 1. تبويب إدارة بطاقات المميزات */}
      {/* ========================================================================= */}
      {subTab === 'features' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((feature, idx) => (
            <div
              key={feature.id}
              className={`p-5 rounded-3xl tarqa-glass-card border transition-all flex flex-col justify-between space-y-4 relative ${
                feature.isVisible
                  ? 'border-slate-200/80 dark:border-slate-800 shadow-sm'
                  : 'opacity-60 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30'
              }`}
            >
              <div className="space-y-3">
                {/* الرأس: الشارة والأزرار السريعة */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                      {feature.badge}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 font-mono">
                      #{idx + 1}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    {/* تحريك لأعلى */}
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMoveFeature(feature.id, 'up')}
                      className={`p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition ${idx === 0 ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`}
                      title="تحريك لأعلى"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    {/* تحريك لأسفل */}
                    <button
                      type="button"
                      disabled={idx === features.length - 1}
                      onClick={() => handleMoveFeature(feature.id, 'down')}
                      className={`p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition ${idx === features.length - 1 ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`}
                      title="تحريك لأسفل"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    {/* إخفاء / إظهار */}
                    <button
                      type="button"
                      onClick={() => handleToggleVisibility(feature)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                      title={feature.isVisible ? 'إخفاء من الصفحة الرئيسية' : 'إظهار في الصفحة الرئيسية'}
                    >
                      {feature.isVisible ? <Eye className="w-3.5 h-3.5 text-emerald-500" /> : <EyeOff className="w-3.5 h-3.5" />}
                    </button>
                    {/* نسخ */}
                    <button
                      type="button"
                      onClick={() => handleDuplicateFeature(feature.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-sky-400 hover:bg-sky-500/10 transition cursor-pointer"
                      title="نسخ هذه الميزة"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    {/* تعديل */}
                    <button
                      type="button"
                      onClick={() => {
                        setEditingFeature({ ...feature });
                        setIsFeatureModalOpen(true);
                      }}
                      className="p-1.5 rounded-lg text-amber-500 hover:bg-amber-500/10 transition cursor-pointer"
                      title="تعديل الميزة بالكامل"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    {/* حذف */}
                    <button
                      type="button"
                      onClick={() => handleDeleteFeature(feature.id)}
                      className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 transition cursor-pointer"
                      title="حذف الميزة"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* معاينة الأيقونة والعنوان */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-500 flex items-center justify-center shrink-0 border border-amber-500/30">
                    {renderIconComponent(feature.icon, 'w-5 h-5')}
                  </div>
                  <div>
                    <h3 className="font-black text-sm text-slate-900 dark:text-white leading-tight">
                      {feature.title}
                    </h3>
                    <span className="text-[10px] text-slate-400 font-mono">
                      ثيم: {feature.colorTheme || 'amber'} | أيقونة: {feature.icon}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-3">
                  {feature.description}
                </p>

                {/* حالة الميزة وأزرار التبديل السريع (مفعلة / مغلقة مؤقتاً / قريباً) */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">حالة الميزة:</span>
                    {(feature.status || 'active') === 'active' && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span>مفعلة وشغالة 🟢</span>
                      </span>
                    )}
                    {feature.status === 'paused' && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center gap-1">
                        <span>🔒 مغلقة مؤقتاً</span>
                      </span>
                    )}
                    {feature.status === 'coming-soon' && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/30 flex items-center gap-1">
                        <span>⏳ قريباً جداً</span>
                      </span>
                    )}
                  </div>

                  {/* أزرار التبديل السريعة بنقرة واحدة */}
                  <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 dark:bg-slate-900/70 rounded-xl border border-slate-200 dark:border-slate-800 text-[10px]">
                    <button
                      type="button"
                      onClick={() => handleQuickStatusChange(feature, 'active')}
                      className={`py-1 rounded-lg font-bold transition cursor-pointer flex items-center justify-center gap-1 ${
                        (feature.status || 'active') === 'active'
                          ? 'bg-emerald-500 text-white shadow-sm font-black'
                          : 'text-slate-500 hover:text-emerald-500 hover:bg-emerald-500/10'
                      }`}
                      title="تفعيل الميزة وجعلها متاحة فوراً"
                    >
                      <span>🟢 مفعلة</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickStatusChange(feature, 'paused')}
                      className={`py-1 rounded-lg font-bold transition cursor-pointer flex items-center justify-center gap-1 ${
                        feature.status === 'paused'
                          ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                          : 'text-slate-500 hover:text-amber-500 hover:bg-amber-500/10'
                      }`}
                      title="إغلاق الميزة مؤقتاً للصيانة والتطوير"
                    >
                      <span>🔒 مغلقة</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickStatusChange(feature, 'coming-soon')}
                      className={`py-1 rounded-lg font-bold transition cursor-pointer flex items-center justify-center gap-1 ${
                        feature.status === 'coming-soon'
                          ? 'bg-sky-500 text-white shadow-sm font-black'
                          : 'text-slate-500 hover:text-sky-500 hover:bg-sky-500/10'
                      }`}
                      title="جعل الميزة قريباً مع شارة الترقب"
                    >
                      <span>⏳ قريباً</span>
                    </button>
                  </div>
                </div>

                {/* النقاط السريعة */}
                {feature.bullets && feature.bullets.length > 0 && (
                  <div className="space-y-1 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                    {feature.bullets.map((b, bIdx) => (
                      <div key={bIdx} className="text-[11px] text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                        <span className="text-amber-500 font-bold">•</span>
                        <span className="truncate">{b}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* الفوتر: نوع الإجراء والرابط ونصوص الأزرار */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-400">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    {feature.actionType === 'courses'
                      ? '🎓 المحاضرات'
                      : feature.actionType === 'mock-exam'
                      ? '⚡ محاكي قياس'
                      : feature.actionType === 'coming-soon'
                      ? '⏳ قريباً'
                      : feature.actionType === 'telegram-modal'
                      ? '💬 تليجرام'
                      : feature.actionType === 'tab'
                      ? `📑 تبويب: ${feature.targetTab}`
                      : '🔗 رابط مخصص'}
                  </span>
                  {feature.actionUrl && (
                    <a
                      href={feature.actionUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 rounded bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 transition"
                      title={feature.actionUrl}
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
                <span className="font-bold text-amber-500">{feature.buttonText}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. تبويب إدارة روابط وقنوات تليجرام */}
      {/* ========================================================================= */}
      {subTab === 'telegram' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-700 dark:text-sky-300 text-xs leading-relaxed flex items-center justify-between flex-wrap gap-2">
            <span>
              💡 <strong>روابط المجتمع والتليجرام:</strong> أي رابط تليجرام تضيفه أو تعدله هنا سينعكس فورياً في نافذة المجتمع التفاعلي على الصفحة الرئيسية.
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {telegramGroups.map((group) => (
              <div
                key={group.id}
                className="p-5 rounded-2xl tarqa-glass-card border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between space-y-4 shadow-sm"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                      {group.badge}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <a
                        href={group.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-sky-500 transition"
                        title="تجربة الرابط في تليجرام"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingGroup({ ...group });
                          setIsGroupModalOpen(true);
                        }}
                        className="p-1.5 rounded-lg text-amber-500 hover:bg-amber-500/10 transition"
                        title="تعديل الرابط والبيانات"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteGroup(group.id)}
                        className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 transition"
                        title="حذف القروب"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                    {group.name}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    {group.description}
                  </p>

                  <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-900/80 font-mono text-[11px] text-sky-600 dark:text-sky-400 truncate">
                    {group.url}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
                  <span>{group.isMain ? '⭐ المجموعة الرئيسية' : 'مجموعة فرعية'}</span>
                  <a
                    href={group.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold text-sky-500 hover:underline flex items-center gap-1"
                  >
                    <span>فتح الرابط</span>
                    <span>↗</span>
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. نافذة مودال لتعديل / إضافة ميزة بكل تفاصيلها وروابطها */}
      {/* ========================================================================= */}
      {isFeatureModalOpen && editingFeature && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="tarqa-glass-card border border-amber-500/30 bg-white dark:bg-[#0c0f1a] w-full max-w-2xl rounded-3xl p-6 sm:p-8 shadow-2xl max-h-[92vh] overflow-y-auto space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500" />
                <span>التحكم الشامل في الميزة والروابط والألوان</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsFeatureModalOpen(false)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveFeature} className="space-y-4 text-xs">
              {/* اختيار الثيم اللوني */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  الثيم اللوني للبطاقة:
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {AVAILABLE_THEMES.map((theme) => (
                    <button
                      type="button"
                      key={theme.id}
                      onClick={() => setEditingFeature({ ...editingFeature, colorTheme: theme.id })}
                      className={`p-2 rounded-xl text-center font-bold text-[11px] border transition cursor-pointer ${
                        editingFeature.colorTheme === theme.id
                          ? `${theme.colorClass} ${theme.borderClass} ring-2 ring-amber-400`
                          : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      {theme.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* اختيار الأيقونة */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  أيقونة الميزة:
                </label>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-32 overflow-y-auto p-1 border border-slate-200 dark:border-slate-800 rounded-2xl">
                  {AVAILABLE_ICONS.map((item) => {
                    const IconComp = item.icon;
                    const isSelected = editingFeature.icon === item.id;
                    return (
                      <button
                        type="button"
                        key={item.id}
                        onClick={() => setEditingFeature({ ...editingFeature, icon: item.id })}
                        className={`p-2 rounded-xl flex flex-col items-center justify-center gap-1 text-[10px] font-bold border transition cursor-pointer ${
                          isSelected
                            ? 'bg-amber-500/20 text-amber-500 border-amber-500/50'
                            : 'bg-slate-100 dark:bg-slate-900 text-slate-500 hover:text-slate-900 dark:hover:text-white border-transparent'
                        }`}
                      >
                        <IconComp className="w-5 h-5" />
                        <span className="truncate max-w-[60px]">{item.id}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    عنوان الميزة الرئيسي:
                  </label>
                  <input
                    type="text"
                    value={editingFeature.title}
                    onChange={(e) => setEditingFeature({ ...editingFeature, title: e.target.value })}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                    placeholder="مثال: محاضرات تدريب وتأسيس"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    الشارة (Badge النص المصغر):
                  </label>
                  <input
                    type="text"
                    value={editingFeature.badge}
                    onChange={(e) => setEditingFeature({ ...editingFeature, badge: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                    placeholder="مثال: متاح بالكامل 🎓 أو قريباً ⏳"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  الوصف التفصيلي:
                </label>
                <textarea
                  value={editingFeature.description}
                  onChange={(e) => setEditingFeature({ ...editingFeature, description: e.target.value })}
                  rows={3}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white leading-relaxed"
                  placeholder="اكتب وصفاً يشرح الفائدة للطالب..."
                />
              </div>

              {/* قسم التحكم بحالة الميزة: مفعلة / مغلقة مؤقتاً / قريباً */}
              <div className="p-4 rounded-2xl bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 space-y-3">
                <label className="block font-black text-sm text-slate-800 dark:text-white">
                  حالة الميزة في الموقع:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingFeature({ ...editingFeature, status: 'active' })}
                    className={`py-2.5 px-3 rounded-xl font-black text-xs transition cursor-pointer flex flex-col items-center gap-1 border ${
                      (editingFeature.status || 'active') === 'active'
                        ? 'bg-emerald-500 text-white border-emerald-600 shadow-md scale-[1.02]'
                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:border-emerald-400'
                    }`}
                  >
                    <span className="text-sm">🟢</span>
                    <span>مفعلة وشغالة</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditingFeature({ 
                      ...editingFeature, 
                      status: 'paused',
                      statusNotice: editingFeature.statusNotice || 'هذه الميزة مغلقة مؤقتاً لأعمال الصيانة والتطوير الشامل 🔒'
                    })}
                    className={`py-2.5 px-3 rounded-xl font-black text-xs transition cursor-pointer flex flex-col items-center gap-1 border ${
                      editingFeature.status === 'paused'
                        ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-md scale-[1.02]'
                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:border-amber-400'
                    }`}
                  >
                    <span className="text-sm">🔒</span>
                    <span>مغلقة مؤقتاً</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditingFeature({ 
                      ...editingFeature, 
                      status: 'coming-soon',
                      statusNotice: editingFeature.statusNotice || 'قريباً جداً في التحديث القادم بإذن الله ⏳'
                    })}
                    className={`py-2.5 px-3 rounded-xl font-black text-xs transition cursor-pointer flex flex-col items-center gap-1 border ${
                      editingFeature.status === 'coming-soon'
                        ? 'bg-sky-500 text-white border-sky-600 shadow-md scale-[1.02]'
                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:border-sky-400'
                    }`}
                  >
                    <span className="text-sm">⏳</span>
                    <span>قريباً جداً</span>
                  </button>
                </div>

                {/* نص التنبيه المخصص عند الإغلاق أو قريباً */}
                {editingFeature.status && editingFeature.status !== 'active' && (
                  <div className="pt-2 border-t border-amber-500/20 space-y-2 animate-in fade-in">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      رسالة التنبيه التي تظهر للطالب عند النقر:
                    </label>
                    <input
                      type="text"
                      value={editingFeature.statusNotice || ''}
                      onChange={(e) => setEditingFeature({ ...editingFeature, statusNotice: e.target.value })}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-medium"
                      placeholder="مثال: هذه الميزة مغلقة مؤقتاً للتطوير الشامل 🔒"
                    />
                    <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
                      <span className="text-slate-400 font-bold">نماذج سريعة:</span>
                      <button
                        type="button"
                        onClick={() => setEditingFeature({ ...editingFeature, statusNotice: 'هذه الميزة مغلقة مؤقتاً لأعمال الصيانة والتطوير الشامل 🔒' })}
                        className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition cursor-pointer"
                      >
                        🔒 مغلقة مؤقتاً للتطوير
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingFeature({ ...editingFeature, statusNotice: 'قريباً جداً في التحديث القادم بإذن الله ⏳' })}
                        className="px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 hover:bg-sky-500/20 transition cursor-pointer"
                      >
                        ⏳ قريباً في التحديث القادم
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* نوع الإجراء والروابط - تحكم كامل ومفتوح بما فيها روابط تليجرام المباشرة */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      طبيعة الإجراء عند الضغط:
                    </label>
                    <select
                      value={editingFeature.actionType}
                      onChange={(e) => setEditingFeature({ ...editingFeature, actionType: e.target.value as FeatureActionType })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold"
                    >
                      <option value="courses">🎓 الانتقال لصفحة المحاضرات والدورات</option>
                      <option value="url">🔗 رابط خارجي مخصص (تليجرام، يوتيوب، قناة...)</option>
                      <option value="telegram-modal">💬 فتح نافذة مجتمع تليجرام التفاعلي</option>
                      <option value="mock-exam">⚡ محاكي الاختبارات (قريباً ⏳)</option>
                      <option value="coming-soon">⏳ مغلق مؤقتاً للتطوير / قريباً</option>
                      <option value="tab">📑 انتقال لتبويب داخلي في الموقع (Dashboard, Leaderboard...)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      نص الزر:
                    </label>
                    <input
                      type="text"
                      value={editingFeature.buttonText}
                      onChange={(e) => setEditingFeature({ ...editingFeature, buttonText: e.target.value })}
                      required
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold"
                      placeholder="مثال: دخول المحاضرات أو انضم لقناة تليجرام"
                    />
                  </div>
                </div>

                {/* حقول الروابط المخصصة وروابط تليجرام */}
                {(editingFeature.actionType === 'url' || editingFeature.actionType === 'telegram-modal') && (
                  <div className="space-y-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <label className="block font-bold text-slate-700 dark:text-slate-300 text-xs">
                          الرابط المخصص / رابط تليجرام:
                        </label>
                        <span className="text-[10px] text-slate-400">يدعم روابط تليجرام، يوتيوب، درايف أو أي موقع</span>
                      </div>
                      <input
                        type="url"
                        value={editingFeature.actionUrl || ''}
                        onChange={(e) => setEditingFeature({ ...editingFeature, actionUrl: e.target.value })}
                        required={editingFeature.actionType === 'url'}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono text-xs"
                        placeholder="https://t.me/tr23km أو https://t.me/your_channel"
                      />
                    </div>

                    {/* أزرار سريعة لاختيار روابط تليجرام المنصة */}
                    <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
                      <span className="text-slate-400 font-bold">روابط تليجرام سريعة:</span>
                      <button
                        type="button"
                        onClick={() => setEditingFeature({ 
                          ...editingFeature, 
                          actionType: 'url', 
                          actionUrl: 'https://t.me/tr23km',
                          buttonText: editingFeature.buttonText || 'انضم لقناة تليجرام 📢'
                        })}
                        className="px-2 py-1 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 hover:bg-sky-500/20 transition font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <span>📢 قناة طرقع (t.me/tr23km)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingFeature({ 
                          ...editingFeature, 
                          actionType: 'url', 
                          actionUrl: 'https://t.me/tarqa3_chat',
                          buttonText: editingFeature.buttonText || 'انضم لمجموعة النقاش 💬'
                        })}
                        className="px-2 py-1 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 hover:bg-sky-500/20 transition font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <span>💬 جروب النقاشات</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingFeature({ 
                          ...editingFeature, 
                          actionType: 'url', 
                          actionUrl: 'https://t.me/tarqa3_foundation',
                          buttonText: editingFeature.buttonText || 'قناة التأسيس الذهني 🎓'
                        })}
                        className="px-2 py-1 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 hover:bg-sky-500/20 transition font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <span>🎓 قناة التأسيس</span>
                      </button>
                    </div>

                    <label className="flex items-center gap-2 font-bold text-xs cursor-pointer pt-1">
                      <input
                        type="checkbox"
                        checked={editingFeature.openInNewTab !== false}
                        onChange={(e) => setEditingFeature({ ...editingFeature, openInNewTab: e.target.checked })}
                        className="rounded border-slate-700 text-amber-500 focus:ring-amber-400"
                      />
                      <span>فتح الرابط في نافذة جديدة مستقلة (_blank)</span>
                    </label>
                  </div>
                )}

                {editingFeature.actionType === 'tab' && (
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      اختر التبويب الداخلي المطلوب فتحه:
                    </label>
                    <select
                      value={editingFeature.targetTab || 'courses'}
                      onChange={(e) => setEditingFeature({ ...editingFeature, targetTab: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium"
                    >
                      {INTERNAL_TABS.map((tab) => (
                        <option key={tab.id} value={tab.id}>
                          {tab.label} ({tab.id})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {editingFeature.actionType === 'coming-soon' && (
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      نص التنبيه الذي يظهر للطالب عند الضغط:
                    </label>
                    <input
                      type="text"
                      value={editingFeature.comingSoonNotice || ''}
                      onChange={(e) => setEditingFeature({ ...editingFeature, comingSoonNotice: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium"
                      placeholder="مثال: محاكي قياس يخضع للتطوير وسيتم إطلاقه قريباً جداً ⏳"
                    />
                  </div>
                )}
              </div>

              {/* إدارة النقاط السريعة (Bullets) بتفاعل مرن */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  النقاط السريعة والمزايا الفرعية:
                </label>
                <div className="space-y-2 mb-2">
                  {editingFeature.bullets?.map((bullet, bIdx) => (
                    <div key={bIdx} className="flex items-center gap-2">
                      <span className="text-amber-500 font-bold">•</span>
                      <input
                        type="text"
                        value={bullet}
                        onChange={(e) => {
                          const updatedB = [...editingFeature.bullets];
                          updatedB[bIdx] = e.target.value;
                          setEditingFeature({ ...editingFeature, bullets: updatedB });
                        }}
                        className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveBullet(bIdx)}
                        className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 transition"
                        title="حذف النقطة"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newBulletText}
                    onChange={(e) => setNewBulletText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddBullet();
                      }
                    }}
                    placeholder="أضف نقطة جديدة واضغط Enter..."
                    className="flex-1 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs"
                  />
                  <button
                    type="button"
                    onClick={handleAddBullet}
                    className="px-3.5 py-2 rounded-xl font-bold bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-white hover:bg-amber-500 hover:text-slate-950 transition text-xs"
                  >
                    إضافة نقطة +
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-4 pt-2">
                <label className="flex items-center gap-2 font-bold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingFeature.isVisible}
                    onChange={(e) => setEditingFeature({ ...editingFeature, isVisible: e.target.checked })}
                    className="rounded border-slate-700 text-amber-500 focus:ring-amber-400"
                  />
                  <span>إظهار في الصفحة الرئيسية للمنصة</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsFeatureModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-white"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-md shadow-amber-500/25 cursor-pointer"
                >
                  حفظ وتطبيق الميزة الآن
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. نافذة مودال لتعديل / إضافة قروب تليجرام */}
      {/* ========================================================================= */}
      {isGroupModalOpen && editingGroup && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="tarqa-glass-card border border-sky-500/30 bg-white dark:bg-[#0c0f1a] w-full max-w-lg rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                تعديل / إضافة رابط قروب أو قناة تليجرام
              </h3>
              <button
                type="button"
                onClick={() => setIsGroupModalOpen(false)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveGroup} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  اسم القروب أو القناة:
                </label>
                <input
                  type="text"
                  value={editingGroup.name}
                  onChange={(e) => setEditingGroup({ ...editingGroup, name: e.target.value })}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  placeholder="مثال: قروب تجميعات قدرات 1446 💬"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  رابط التليجرام (URL):
                </label>
                <input
                  type="url"
                  value={editingGroup.url}
                  onChange={(e) => setEditingGroup({ ...editingGroup, url: e.target.value })}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono"
                  placeholder="https://t.me/your_group_link"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  الوصف المصغر:
                </label>
                <textarea
                  value={editingGroup.description}
                  onChange={(e) => setEditingGroup({ ...editingGroup, description: e.target.value })}
                  rows={2}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  placeholder="وصف مختصر لمحتوى القروب..."
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  الشارة (Badge):
                </label>
                <input
                  type="text"
                  value={editingGroup.badge}
                  onChange={(e) => setEditingGroup({ ...editingGroup, badge: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  placeholder="مثال: القروب العام أو تجميعات 1446"
                />
              </div>

              <div className="flex items-center gap-4 pt-2">
                <label className="flex items-center gap-2 font-bold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingGroup.isMain || false}
                    onChange={(e) => setEditingGroup({ ...editingGroup, isMain: e.target.checked })}
                    className="rounded border-slate-700 text-sky-500 focus:ring-sky-400"
                  />
                  <span>تمييز كمجموعة رئيسية ⭐</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsGroupModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-white"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl font-bold bg-sky-500 hover:bg-sky-600 text-white shadow-md shadow-sky-500/25 cursor-pointer"
                >
                  حفظ الرابط الآن
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
