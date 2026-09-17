import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { 
  Lock, 
  Mail, 
  User, 
  Eye, 
  EyeOff, 
  X, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Send, 
  ArrowRight,
  KeyRound,
  Phone
} from 'lucide-react';
import { authService, TarqaUser } from '../lib/supabase';
import { SUPPORT_EMAIL, SUPPORT_PHONE_EGYPT, SUPPORT_PHONE_EGYPT_FORMATTED } from '../lib/constants';

interface InteractiveLoginPageProps {
  isOpen?: boolean;
  onClose?: () => void;
  onSuccess?: (user: TarqaUser) => void;
  initialTab?: 'signin' | 'signup';
  onOpenPolicies?: (tab: 'terms' | 'privacy' | 'cookies' | 'refund') => void;
  isStandalonePage?: boolean;
}

export const InteractiveLoginPage: React.FC<InteractiveLoginPageProps> = ({
  isOpen = true,
  onClose,
  onSuccess,
  initialTab = 'signin',
  onOpenPolicies,
  isStandalonePage = false,
}) => {
  // التبويب الحالي
  const [tab, setTab] = useState<'signin' | 'signup'>(initialTab);

  // حقول الإدخال
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [targetScore, setTargetScore] = useState(100);
  const [telegramUsername, setTelegramUsername] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // حالات تفاعل الحروف والعيون (بدون أي ريندر لرياكت على حركة الماوس)
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [isEmailFocused, setIsEmailFocused] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [isCelebration, setIsCelebration] = useState(false);

  // حالة المعالجة والرسائل
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showTelegramDirect, setShowTelegramDirect] = useState(false);
  const [telegramHandle, setTelegramHandle] = useState('');

  // مراجع عناصر العيون (ط، قع) لحساب الزوايا والتحريك المباشر عبر كرت الشاشة
  const eyeContainerRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const containerRef = useRef<HTMLDivElement>(null);

  // إعادة ضبط كاملة لكافة حالات الأنيميشن والرسائل عند فتح النافذة أو إغلاقها
  useEffect(() => {
    setIsCelebration(false);
    setIsShaking(false);
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsPasswordFocused(false);
    setIsEmailFocused(false);
    setPassword('');
  }, [isOpen]);

  // إعادة الضبط الفوري عند تسجيل الخروج أو تغيير حالة المستخدم
  useEffect(() => {
    const handleResetAll = () => {
      setIsCelebration(false);
      setIsShaking(false);
      setErrorMessage(null);
      setSuccessMessage(null);
      setIsPasswordFocused(false);
      setIsEmailFocused(false);
      setPassword('');
    };

    window.addEventListener('tarqa_user_changed', handleResetAll);
    window.addEventListener('tarqa_roles_changed', handleResetAll);
    return () => {
      window.removeEventListener('tarqa_user_changed', handleResetAll);
      window.removeEventListener('tarqa_roles_changed', handleResetAll);
    };
  }, []);

  // متابعة حركة مؤشر الماوس بسلاسة فائقة وبشكل مباشر على CSS Variables بدون أي إعادة رندر لرياكت
  useEffect(() => {
    if (!isOpen && !isStandalonePage) return;

    let rafId: number | null = null;
    let latestPos = { x: 0, y: 0 };

    const updateEyesDOM = () => {
      ['tar', 'qa'].forEach((key) => {
        const el = eyeContainerRefs.current[key];
        if (!el) return;

        const rect = el.getBoundingClientRect();
        const eyeX = rect.left + rect.width / 2;
        const eyeY = rect.top + rect.height / 2;

        const dx = latestPos.x - eyeX;
        const dy = latestPos.y - eyeY;
        const dist = Math.hypot(dx, dy);

        if (dist === 0) {
          el.style.setProperty('--pupil-x', '0px');
          el.style.setProperty('--pupil-y', '0px');
          return;
        }

        const angle = Math.atan2(dy, dx);
        const maxTravel = 5;
        const travel = Math.min(dist / 22, maxTravel);

        const px = Math.cos(angle) * travel;
        const py = Math.sin(angle) * travel;

        el.style.setProperty('--pupil-x', `${px.toFixed(2)}px`);
        el.style.setProperty('--pupil-y', `${py.toFixed(2)}px`);
      });
      rafId = null;
    };

    const handleMouseMove = (e: MouseEvent) => {
      latestPos = { x: e.clientX, y: e.clientY };
      if (rafId === null) {
        rafId = requestAnimationFrame(updateEyesDOM);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches[0]) {
        latestPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        if (rafId === null) {
          rafId = requestAnimationFrame(updateEyesDOM);
        }
      }
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleTouchMove);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [isOpen, isStandalonePage]);

  // تحديث وضعية البؤبؤ عند التركيز على البريد أو الاهتزاز
  useEffect(() => {
    if (!isOpen && !isStandalonePage) return;
    ['tar', 'qa'].forEach((key) => {
      const el = eyeContainerRefs.current[key];
      if (!el) return;
      if (isEmailFocused) {
        el.style.setProperty('--pupil-x', '0px');
        el.style.setProperty('--pupil-y', '3.5px');
      } else if (isShaking) {
        el.style.setProperty('--pupil-x', '0px');
        el.style.setProperty('--pupil-y', '2px');
      } else {
        el.style.setProperty('--pupil-x', '0px');
        el.style.setProperty('--pupil-y', '0px');
      }
    });
  }, [isEmailFocused, isShaking, isOpen, isStandalonePage]);

  // تشغيل أنيميشن الاهتزاز السريع عند الخطأ
  const triggerRapidShake = (customMsg?: string) => {
    setIsShaking(true);
    setIsCelebration(false);
    setErrorMessage(customMsg || 'كلمة المرور غير صحيحة! الحروف اهتزت واحتجت ⚠️');

    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([80, 50, 80, 50, 80]);
    }

    setTimeout(() => {
      setIsShaking(false);
    }, 750);
  };

  // تشغيل أنيميشن الاحتفال الحماسي والمفرقعات عند النجاح
  const triggerCelebration = (user: TarqaUser, customMsg?: string) => {
    setIsCelebration(true);
    setIsShaking(false);
    setErrorMessage(null);
    setSuccessMessage(customMsg || `أهلاً بك يا ${user.fullName || 'بطل'}! طرقع يرحب بك 🎉`);

    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { x: 0.2, y: 0.6 },
        colors: ['#e09401', '#f59e0b', '#fbbf24', '#ffffff', '#ef4444'],
      });
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { x: 0.8, y: 0.6 },
        colors: ['#e09401', '#f59e0b', '#fbbf24', '#ffffff', '#3b82f6'],
      });
    } catch (e) {
      console.warn('Confetti error:', e);
    }

    window.dispatchEvent(new Event('tarqa_roles_changed'));
    window.dispatchEvent(new Event('tarqa_user_changed'));

    // إعادة ضبط وإيقاف أنيميشن الاحتفال بعد انتهائه لعدم تكراره عند الخروج
    setTimeout(() => {
      setIsCelebration(false);
      setSuccessMessage(null);
      if (onSuccess) onSuccess(user);
      if (onClose) onClose();
    }, 1800);
  };

  // معالجة تسجيل الدخول
  const handleSubmitSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      triggerRapidShake('يرجى كتابة البريد الإلكتروني وكلمة المرور');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await authService.signIn({
        email: email.trim(),
        password: password.trim(),
      });
      triggerCelebration(res.user, 'تم تسجيل الدخول بنجاح! طرقع فخور بك 🎯');
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.includes('Invalid login credentials') || msg.includes('invalid_grant')) {
        triggerRapidShake('كلمة المرور أو البريد غير صحيح! حاول مجدداً');
      } else {
        triggerRapidShake(msg || 'تعذر تسجيل الدخول، تأكد من بياناتك');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // معالجة إنشاء الحساب
  const handleSubmitSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim() || !fullName.trim()) {
      triggerRapidShake('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    if (password.length < 6) {
      triggerRapidShake('كلمة المرور يجب ألا تقل عن 6 أحرف أو أرقام');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await authService.signUp({
        email: email.trim(),
        password: password.trim(),
        fullName: fullName.trim(),
        targetScore: Number(targetScore) || 100,
        telegramUsername: telegramUsername.trim() || undefined,
      });
      triggerCelebration(res.user, 'تم إنشاء حسابك بنجاح! مرحباً بك في طرقع 🚀');
    } catch (err: any) {
      const msg = err?.message || '';
      triggerRapidShake(msg || 'حدث خطأ أثناء إنشاء الحساب');
    } finally {
      setIsLoading(false);
    }
  };

  // تسجيل الدخول السريع عبر تليجرام
  const handleTelegramDirectLogin = async () => {
    const raw = telegramHandle.trim();
    if (!raw) {
      triggerRapidShake('يرجى كتابة يوزر تليجرام أو المعرف');
      return;
    }

    setIsLoading(true);
    try {
      const clean = raw.replace(/^@/, '');
      const isNum = /^\d+$/.test(clean);
      let numericHash = 0;
      for (let i = 0; i < clean.length; i++) {
        numericHash = (numericHash << 5) - numericHash + clean.charCodeAt(i);
        numericHash |= 0;
      }
      const safeId = isNum ? Number(clean) : Math.abs(numericHash) % 900000000 + 100000000;

      const user = await authService.signInWithTelegram({
        id: safeId,
        first_name: clean,
        username: clean,
      });

      triggerCelebration(user, `تم الدخول بنجاح عبر تليجرام يا ${user.fullName}! 🚀`);
    } catch (err: any) {
      triggerRapidShake(err?.message || 'تعذر الدخول بتليجرام');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  // مكون العيون التفاعلية بالبوكس الأبيض مع أنيميشن الإغلاق السلس كخط عريض أبيض
  // مكون العيون التفاعلية بالبوكس الأبيض فائق الخفة والسرعة بمعالجة كرت الشاشة المباشرة
  const renderEyes = (letterKey: string) => {
    const isClosed = isPasswordFocused && !showPassword;

    return (
      <div 
        ref={(el) => (eyeContainerRefs.current[letterKey] = el)}
        className="flex items-center justify-center gap-1.5 select-none pointer-events-none h-[42px]"
      >
        {/* حالة الاحتفال بالنجاح: عيون برتقالية مقوسة سعيدة ^ ^ */}
        {isCelebration ? (
          <div className="flex items-center gap-2 text-[#e09401] font-black animate-scale-up">
            <span className="text-2xl font-black leading-none drop-shadow">^</span>
            <span className="text-2xl font-black leading-none drop-shadow">^</span>
          </div>
        ) : (
          /* العيون الكرتونية بالبوكس الأبيض الموحد المتطابق تماماً بين الموبايل واللابتوب */
          <>
            {/* العين الأولى */}
            <div 
              className={`relative flex items-center justify-center overflow-hidden border-2 border-slate-950 shadow-xl bg-white transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
                isClosed ? 'h-[9px] w-[32px] rounded-full' : 'h-[36px] w-[26px] rounded-[18px]'
              }`}
            >
              {/* شق جفن مغلق أسود رفيع داخل البوكس الأبيض عند الإغلاق */}
              <span 
                className={`absolute w-4 h-[2px] bg-slate-950 rounded-full z-10 pointer-events-none transition-all duration-150 ${
                  isClosed ? 'opacity-100 scale-x-100' : 'opacity-0 scale-x-0'
                }`}
              />

              {/* البؤبؤ البرتقالي المتحرك بداخل العين (نفس المقاس الموحد بدقة على كل الأجهزة) */}
              <div 
                className={`w-[14px] h-[14px] rounded-full bg-[#e09401] border border-amber-600 relative flex items-center justify-center shadow-inner transition-opacity duration-150 ${
                  isClosed ? 'opacity-0 scale-25' : 'opacity-100 scale-100'
                }`}
                style={{
                  transform: 'translate3d(var(--pupil-x, 0px), var(--pupil-y, 0px), 0)',
                  willChange: 'transform',
                  transition: 'transform 0.06s ease-out',
                }}
              >
                {/* بؤبؤ داخلي داكن */}
                <span className="w-[6px] h-[6px] rounded-full bg-slate-950 block" />
                {/* لمعة وبريق العين الأبيض */}
                <span className="absolute top-0.5 right-0.5 w-[3px] h-[3px] bg-white rounded-full shadow-sm pointer-events-none" />
              </div>
            </div>

            {/* العين الثانية */}
            <div 
              className={`relative flex items-center justify-center overflow-hidden border-2 border-slate-950 shadow-xl bg-white transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
                isClosed ? 'h-[9px] w-[32px] rounded-full' : 'h-[36px] w-[26px] rounded-[18px]'
              }`}
            >
              {/* شق جفن مغلق أسود رفيع داخل البوكس الأبيض عند الإغلاق */}
              <span 
                className={`absolute w-4 h-[2px] bg-slate-950 rounded-full z-10 pointer-events-none transition-all duration-150 ${
                  isClosed ? 'opacity-100 scale-x-100' : 'opacity-0 scale-x-0'
                }`}
              />

              {/* البؤبؤ البرتقالي المتحرك بداخل العين */}
              <div 
                className={`w-[14px] h-[14px] rounded-full bg-[#e09401] border border-amber-600 relative flex items-center justify-center shadow-inner transition-opacity duration-150 ${
                  isClosed ? 'opacity-0 scale-25' : 'opacity-100 scale-100'
                }`}
                style={{
                  transform: 'translate3d(var(--pupil-x, 0px), var(--pupil-y, 0px), 0)',
                  willChange: 'transform',
                  transition: 'transform 0.06s ease-out',
                }}
              >
                {/* بؤبؤ داخلي داكن */}
                <span className="w-[6px] h-[6px] rounded-full bg-slate-950 block" />
                {/* لمعة وبريق العين الأبيض */}
                <span className="absolute top-0.5 right-0.5 w-[3px] h-[3px] bg-white rounded-full shadow-sm pointer-events-none" />
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div 
      ref={containerRef}
      className={`fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto bg-slate-950/85 backdrop-blur-xl transition-all duration-300 ${
        isStandalonePage ? 'relative min-h-screen bg-gradient-to-br from-slate-950 via-[#070b14] to-slate-900' : ''
      }`}
      dir="rtl"
    >
      {/* إضاءات نيون متدرجة في الخلفية */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-80 h-80 rounded-full bg-amber-500/15 blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-amber-600/10 blur-3xl animate-pulse" style={{ animationDelay: '1.5s' }} />
      </div>

      {/* بطاقة اللوجن الرئيسية */}
      <div 
        className={`relative w-full max-w-4xl bg-white/95 dark:bg-gradient-to-b dark:from-[#181108]/95 dark:via-[#110c1a]/92 dark:to-[#07050e]/95 border border-sky-200/90 dark:border-amber-500/35 rounded-3xl sm:rounded-[2.5rem] shadow-2xl shadow-sky-500/10 dark:shadow-black/90 overflow-hidden transition-all duration-300 my-auto ${
          isShaking ? 'ring-4 ring-rose-500/60' : isCelebration ? 'ring-4 ring-amber-400/80 shadow-amber-500/40' : ''
        }`}
      >
        {/* زر الإغلاق */}
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 left-4 z-20 p-2.5 rounded-2xl bg-white/80 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-sky-200/70 dark:border-slate-700/50 transition cursor-pointer shadow-sm"
            title="إغلاق"
            aria-label="إغلاق النافذة"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[590px]">
          
          {/* ================================================================= */}
          {/* 1. قسم حروف كلمة "طرقع" بشبكة 2x2 وبنفس أسلوب الشعار الرسمي */}
          {/* ================================================================= */}
          <div className="lg:col-span-5 bg-gradient-to-b from-sky-50/90 via-sky-100/50 to-white/90 dark:from-slate-950 dark:via-[#120a1c] dark:to-slate-950 p-6 sm:p-7 flex flex-col items-center justify-between border-b lg:border-b-0 lg:border-l border-sky-200/80 dark:border-slate-800/80 relative overflow-hidden">
            
            {/* الهيدر الترحيبي مع الشعار المعتمد */}
            <div className="text-center w-full z-10">
              <img 
                src="/tarqa_clean_logo.png" 
                alt="شعار طرقع" 
                className="h-12 sm:h-14 object-contain mx-auto mb-2 drop-shadow-md"
              />
              <p className="text-[11px] text-slate-400 mt-1 max-w-xs mx-auto">
                {isCelebration 
                  ? '🎉 الحروف ترقص حماساً وترحب بك!' 
                  : isShaking 
                  ? '⚠️ كلمة المرور خاطئة، اهتزت الحروف احتجاجاً!' 
                  : isPasswordFocused && !showPassword
                  ? '🙈 الحروف أغلقت عيونها احتراماً لخصوصيتك!'
                  : '👀 حرك الماوس لتشاهد عيون الحروف تتبعك بدقة'}
              </p>
            </div>

            {/* ================================================================= */}
            {/* قسم كلمة طرقع: "طر" بالأعلى و"قع" بالأسفل بمسافة واضحة وبدون بوكسات */}
            {/* ================================================================= */}
            <div 
              className={`my-auto py-5 sm:py-7 flex flex-col items-center justify-center gap-3 sm:gap-4 select-none z-10 transition-all duration-300 ${
                isShaking ? 'animate-rapid-shake' : isCelebration ? 'animate-celebration-jump' : ''
              }`}
            >
              
              {/* السطر الأول: "طر" متصلين ببعض كحروف طبيعية للشعار وبحجم موحد تماماً */}
              <div className="relative flex items-center justify-center group cursor-pointer transition-transform duration-300 hover:scale-105">
                <span 
                  className="font-baloo text-9xl font-black text-[#e09401] drop-shadow-[0_14px_28px_rgba(224,148,1,0.45)] block leading-[0.88] select-none tracking-tight"
                >
                  طر
                </span>

                {/* زوج العيون الكرتونية فوق حلقة حرف الطاء (نفس الشكل والمقاس للموبايل واللابتوب) */}
                <div className="absolute top-[38%] right-[22%] -translate-y-1/2">
                  {renderEyes('tar')}
                </div>
              </div>

              {/* السطر الثاني: "قع" متصلين ببعض تحتيهم بمسافة صغيرة واضحة بدون أي تداخل */}
              <div className="relative flex items-center justify-center group cursor-pointer transition-transform duration-300 hover:scale-105">
                <span 
                  className="font-baloo text-9xl font-black text-[#e09401] drop-shadow-[0_14px_28px_rgba(224,148,1,0.45)] block leading-[0.88] select-none tracking-tight"
                >
                  قع
                </span>

                {/* زوج العيون الكرتونية داخل رأس حرف القاف (نفس الشكل والمقاس للموبايل واللابتوب) */}
                <div className="absolute top-[40%] right-[20%] -translate-y-1/2">
                  {renderEyes('qa')}
                </div>
              </div>

            </div>

            {/* عبارة ترحيبية خفيفة أسفل الحروف */}
            <div className="w-full text-center z-10 py-1">
              <p className="text-[11px] text-slate-500 font-medium">
                ✨ منصة طرقع التفاعلية لاختبارات القدرات
              </p>
            </div>

          </div>

          {/* ================================================================= */}
          {/* 2. قسم نموذج تسجيل الدخول والاشتراك - متمركز رأسياً في المنتصف */}
          {/* ================================================================= */}
          <div className="lg:col-span-7 p-6 sm:p-8 flex flex-col justify-between bg-white/90 dark:bg-slate-900/70">
            
            {/* الحاوية المتمركزة رأسياً في منتصف الصفحة */}
            <div className="my-auto w-full max-w-md mx-auto py-3">
              {/* شريط التبديل بين الدخول وحساب جديد */}
              <div className="flex items-center p-1 rounded-2xl bg-sky-100/70 dark:bg-slate-800/90 border border-sky-200/80 dark:border-slate-700/60 mb-5">
                <button
                  type="button"
                  onClick={() => {
                    setTab('signin');
                    setErrorMessage(null);
                    setSuccessMessage(null);
                  }}
                  className={`flex-1 py-2 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                    tab === 'signin'
                      ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black shadow-md shadow-amber-500/25'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <KeyRound className="w-4 h-4" />
                  <span>تسجيل الدخول</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setTab('signup');
                    setErrorMessage(null);
                    setSuccessMessage(null);
                  }}
                  className={`flex-1 py-2 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                    tab === 'signup'
                      ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black shadow-md shadow-amber-500/25'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  <span>إنشاء حساب جديد</span>
                </button>
              </div>

              {/* رسالة الخطأ (تهتز مع الحروف) */}
              {errorMessage && (
                <div className={`p-3 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs font-bold mb-4 flex items-center gap-2.5 ${
                  isShaking ? 'animate-rapid-shake' : ''
                }`}>
                  <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* رسالة النجاح والاحتفال */}
              {successMessage && (
                <div className="p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-bold mb-4 flex items-center gap-2.5 animate-bounce">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <span>{successMessage}</span>
                </div>
              )}

              {/* فورم الدخول أو إنشاء الحساب */}
              <form onSubmit={tab === 'signin' ? handleSubmitSignIn : handleSubmitSignUp} className="space-y-3.5">
                
                {tab === 'signup' && (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                        الاسم الكامل للطالب
                      </label>
                      <div className="relative">
                        <User className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
                        <input
                          type="text"
                          required
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="مثال: أحمد القحطاني"
                          className="w-full pr-10 pl-3.5 py-2.5 rounded-xl bg-sky-50/60 dark:bg-slate-800/90 border border-sky-200/80 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-xs font-medium focus:border-amber-500 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-amber-500/20 transition outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                        <span>الدرجة المستهدفة في القدرات 🎯</span>
                        <span className="text-amber-500 font-mono font-black">{targetScore}</span>
                      </label>
                      <input
                        type="range"
                        min="70"
                        max="100"
                        value={targetScore}
                        onChange={(e) => setTargetScore(Number(e.target.value))}
                        className="w-full accent-amber-500 cursor-pointer"
                      />
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    البريد الإلكتروني
                  </label>
                  <div className="relative">
                    <Mail className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onFocus={() => setIsEmailFocused(true)}
                      onBlur={() => setIsEmailFocused(false)}
                      placeholder="student@example.com"
                      className="w-full pr-10 pl-3.5 py-2.5 rounded-xl bg-sky-50/60 dark:bg-slate-800/90 border border-sky-200/80 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-xs font-medium focus:border-amber-500 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-amber-500/20 transition outline-none"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      كلمة المرور
                    </label>
                    <span className="text-[10px] text-amber-500 dark:text-amber-400 font-medium">
                      {isPasswordFocused && !showPassword ? '🙈 الحروف تغمض عيونها احتراماً لخصوصيتك!' : '👁️ الحروف تتبع حركتك!'}
                    </span>
                  </div>
                  <div className="relative">
                    <Lock className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onFocus={() => setIsPasswordFocused(true)}
                      onBlur={() => setIsPasswordFocused(false)}
                      placeholder="••••••••"
                      className={`w-full pr-10 pl-11 py-2.5 rounded-xl bg-sky-50/60 dark:bg-slate-800/90 border text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-xs font-medium focus:bg-white dark:focus:bg-slate-800 focus:ring-2 transition outline-none ${
                        isShaking 
                          ? 'border-rose-500 focus:ring-rose-500/20' 
                          : 'border-sky-200/80 dark:border-slate-700 focus:border-amber-500 focus:ring-amber-500/20'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white transition p-1 cursor-pointer"
                      title={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {tab === 'signup' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      معرف تليجرام (اختياري للإشعارات الفورية)
                    </label>
                    <div className="relative">
                      <Send className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
                      <input
                        type="text"
                        value={telegramUsername}
                        onChange={(e) => setTelegramUsername(e.target.value)}
                        placeholder="@username"
                        className="w-full pr-10 pl-3.5 py-2.5 rounded-xl bg-sky-50/60 dark:bg-slate-800/90 border border-sky-200/80 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-xs font-medium focus:border-amber-500 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-amber-500/20 transition outline-none"
                      />
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-sm shadow-lg shadow-amber-500/25 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 mt-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>جاري التحقق...</span>
                    </>
                  ) : tab === 'signin' ? (
                    <>
                      <span>دخول للمنصة 🚀</span>
                      <ArrowRight className="w-4 h-4 rotate-180" />
                    </>
                  ) : (
                    <>
                      <span>ابدأ رحلة الـ 100 الآن 🎯</span>
                      <Sparkles className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {/* فاصل الدخول السريع */}
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-800" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-2 bg-slate-900 text-slate-500 font-bold">أو الدخول المباشر</span>
                </div>
              </div>

              {/* خيارات تسجيل الدخول السريع بتليجرام */}
              <div className="space-y-2">
                {!showTelegramDirect ? (
                  <button
                    type="button"
                    onClick={() => setShowTelegramDirect(true)}
                    className="w-full py-2.5 px-3 rounded-xl bg-[#229ED9]/15 hover:bg-[#229ED9]/25 text-[#229ED9] border border-[#229ED9]/30 text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                    <span>الدخول السريع بحساب تليجرام</span>
                  </button>
                ) : (
                  <div className="p-3 rounded-2xl bg-slate-800/90 border border-slate-700 space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={telegramHandle}
                        onChange={(e) => setTelegramHandle(e.target.value)}
                        placeholder="اكتب يوزر تليجرام @username"
                        className="flex-1 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs outline-none focus:border-[#229ED9]"
                      />
                      <button
                        type="button"
                        onClick={handleTelegramDirectLogin}
                        disabled={isLoading}
                        className="px-3 py-1.5 rounded-lg bg-[#229ED9] text-white text-xs font-bold hover:bg-[#1f8ec4] transition cursor-pointer"
                      >
                        دخول
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* خط المساعدة والدعم الفني */}
            <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-[11px] text-center space-y-1 mt-3">
              <div className="text-slate-400 text-[10px]">تواجه مشكلة في الدخول أو تفعيل الحساب؟</div>
              <div className="flex items-center justify-center gap-3 font-bold text-[11px]">
                <a
                  href={`tel:${SUPPORT_PHONE_EGYPT}`}
                  dir="ltr"
                  className="text-emerald-400 hover:underline flex items-center gap-1 font-mono"
                >
                  <Phone className="w-3 h-3 text-emerald-400" />
                  <span>{SUPPORT_PHONE_EGYPT_FORMATTED}</span>
                </a>
                <span className="text-slate-600">•</span>
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className="text-amber-400 hover:underline flex items-center gap-1 font-mono"
                >
                  <Mail className="w-3 h-3 text-amber-400" />
                  <span>{SUPPORT_EMAIL}</span>
                </a>
              </div>
            </div>

            {/* روابط السياسات في الأسفل */}
            <div className="pt-3 text-center border-t border-slate-800/80 mt-3">
              <p className="text-[11px] text-slate-400">
                باستمرارك فأنت توافق على{' '}
                <button
                  type="button"
                  onClick={() => onOpenPolicies && onOpenPolicies('terms')}
                  className="text-amber-400 hover:underline font-bold"
                >
                  شروط الاستخدام
                </button>
                {' '}و{' '}
                <button
                  type="button"
                  onClick={() => onOpenPolicies && onOpenPolicies('privacy')}
                  className="text-amber-400 hover:underline font-bold"
                >
                  سياسة الخصوصية
                </button>
              </p>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
};
