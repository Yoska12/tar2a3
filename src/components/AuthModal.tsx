import React, { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { 
  Lock, 
  Mail, 
  User, 
  Target, 
  Send, 
  X, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  Sparkles,
  Zap,
  ExternalLink,
  Bot,
  AtSign
} from 'lucide-react';
import { signInSchema, signUpSchema, SignInInput, SignUpInput } from '../lib/validations/auth';
import { authService, TarqaUser } from '../lib/supabase';
import { TELEGRAM_BOT_USERNAME, TELEGRAM_BOT_URL, verifyTelegramAuth } from '../lib/telegram';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUserLoggedIn?: (user: TarqaUser) => void;
  initialTab?: 'signin' | 'signup';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onUserLoggedIn,
  initialTab = 'signin',
}) => {
  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>(initialTab);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);
  const [showTelegramDirectInput, setShowTelegramDirectInput] = useState(false);
  const [telegramHandle, setTelegramHandle] = useState('');

  const telegramContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setAuthError(null);
      setAuthSuccess(null);
      setShowTelegramDirectInput(false);
    }
  }, [isOpen, initialTab]);

  // إعداد دالة الاستقبال الرسمية للويدجت (onTelegramAuth)
  useEffect(() => {
    if (!isOpen) return;

    (window as any).onTelegramAuth = async (tgUser: any) => {
      setIsLoading(true);
      setAuthError(null);
      setAuthSuccess(null);

      try {
        // التحقق وتأكيد صحة التوقيع عبر Web Crypto API
        const verification = await verifyTelegramAuth(tgUser);
        if (!verification.isValid && verification.error) {
          console.warn('[Telegram Auth] Verification issue:', verification.error);
        }

        const user = await authService.signInWithTelegram({
          id: Number(tgUser.id),
          first_name: tgUser.first_name,
          last_name: tgUser.last_name,
          username: tgUser.username,
          photo_url: tgUser.photo_url,
        });

        setAuthSuccess(
          activeTab === 'signup'
            ? `أهلاً بك يا ${user.fullName}! تم إنشاء حسابك الرسمي عبر تليجرام بنجاح 🎯`
            : `أهلاً بك يا ${user.fullName}! تم تسجيل الدخول الرسمي عبر تليجرام بنجاح 🎯`
        );
        window.dispatchEvent(new Event('tarqa_roles_changed'));
        window.dispatchEvent(new Event('tarqa_user_changed'));
        if (onUserLoggedIn) onUserLoggedIn(user);
        setTimeout(() => onClose(), 800);
      } catch (err: any) {
        setAuthError(err?.message || (activeTab === 'signup' ? 'تعذر إنشاء الحساب عبر تليجرام' : 'تعذر تسجيل الدخول عبر تليجرام'));
      } finally {
        setIsLoading(false);
      }
    };

    // تحميل ويدجت تليجرام الرسمي إذا كان الحاوية جاهزة
    const container = telegramContainerRef.current;
    if (container) {
      container.innerHTML = '';
      const script = document.createElement('script');
      script.src = 'https://telegram.org/js/telegram-widget.js?22';
      script.setAttribute('data-telegram-login', TELEGRAM_BOT_USERNAME);
      script.setAttribute('data-size', 'large');
      script.setAttribute('data-radius', '12');
      script.setAttribute('data-request-access', 'write');
      script.setAttribute('data-userpic', 'true');
      script.setAttribute('data-onauth', 'onTelegramAuth(user)');
      script.async = true;
      container.appendChild(script);
    }

    return () => {
      delete (window as any).onTelegramAuth;
    };
  }, [isOpen, activeTab]);

  const {
    register: registerSignIn,
    handleSubmit: handleSignInSubmit,
    formState: { errors: signInErrors },
  } = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
  });

  const {
    register: registerSignUp,
    handleSubmit: handleSignUpSubmit,
    watch: watchSignUp,
    formState: { errors: signUpErrors },
  } = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      targetScore: 100,
    },
  });

  const currentTargetScore = watchSignUp('targetScore', 100);

  if (!isOpen) return null;

  const onSignIn = async (data: SignInInput) => {
    setIsLoading(true);
    setAuthError(null);
    setAuthSuccess(null);

    try {
      const result = await authService.signIn({
        email: data.email,
        password: data.password,
      });

      setAuthSuccess(
        result.isDemo
          ? 'تم تسجيل الدخول بنجاح! مرحباً بك.'
          : 'تم تسجيل الدخول بنجاح! مرحباً بك في طرقع.'
      );
      window.dispatchEvent(new Event('tarqa_roles_changed'));
      window.dispatchEvent(new Event('tarqa_user_changed'));
      if (onUserLoggedIn) onUserLoggedIn(result.user);
      setTimeout(() => onClose(), 800);
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.includes('Invalid login credentials')) {
        setAuthError('البريد الإلكتروني أو كلمة المرور غير صحيحة. إذا كان حسابك جديداً، يرجى التحقق من رسالة تفعيل البريد أو إعادة المحاولة.');
      } else if (msg.includes('Email not confirmed')) {
        setAuthError('يرجى تأكيد بريدك الإلكتروني أولاً عبر الرابط المرسل لبريدك، أو تواصل مع إدارة المنصة.');
      } else {
        setAuthError(msg || 'حدث خطأ أثناء تسجيل الدخول');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const onSignUp = async (data: SignUpInput) => {
    setIsLoading(true);
    setAuthError(null);
    setAuthSuccess(null);

    try {
      const result = await authService.signUp({
        email: data.email,
        password: data.password,
        fullName: data.fullName,
        targetScore: data.targetScore,
        telegramUsername: data.telegramUsername || undefined,
      });

      setAuthSuccess(
        result.isDemo
          ? `تم إنشاء الحساب بنجاح! تم تحديد هدفك: ${data.targetScore || 100} 🎯`
          : `تم إنشاء الحساب بنجاح! تم حفظ بياناتك وهدفك 100 🎯`
      );
      window.dispatchEvent(new Event('tarqa_roles_changed'));
      window.dispatchEvent(new Event('tarqa_user_changed'));
      if (onUserLoggedIn) onUserLoggedIn(result.user);
      setTimeout(() => onClose(), 1000);
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.includes('Email signups are disabled')) {
        setAuthError('إنشاء الحسابات الجديدة بالبريد معطل حالياً في إعدادات Supabase (يرجى تفعيل Allow new users to sign up من لوحة تحكم Supabase)');
      } else if (msg.includes('User already registered') || msg.includes('already registered')) {
        setAuthError('هذا البريد الإلكتروني مسجل بالفعل مسبقاً! انتقل لتبويب "تسجيل الدخول" للدخول به مباشرة.');
      } else {
        setAuthError(msg || 'حدث خطأ أثناء إنشاء الحساب');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // تسجيل الدخول السريع بمعرف تليجرام
  const handleDirectTelegramLogin = async () => {
    const raw = telegramHandle.trim();
    if (!raw) {
      setAuthError('يرجى كتابة يوزر تليجرام (مثال: @username) أو رقم الـ ID');
      return;
    }

    setIsLoading(true);
    setAuthError(null);
    setAuthSuccess(null);

    try {
      const cleanUsername = raw.replace(/^@/, '');
      const isNumeric = /^\d+$/.test(cleanUsername);

      const user = await authService.signInWithTelegram({
        id: isNumeric ? Number(cleanUsername) : Math.floor(100000 + Math.random() * 900000),
        first_name: cleanUsername,
        username: cleanUsername,
      });

      setAuthSuccess(
        activeTab === 'signup'
          ? `أهلاً بك يا ${user.fullName}! تم إنشاء حسابك بنجاح عبر تليجرام @${cleanUsername} 🎯`
          : `أهلاً بك يا ${user.fullName}! تم تسجيل الدخول بنجاح عبر تليجرام @${cleanUsername} 🎯`
      );
      window.dispatchEvent(new Event('tarqa_roles_changed'));
      window.dispatchEvent(new Event('tarqa_user_changed'));
      if (onUserLoggedIn) onUserLoggedIn(user);
      setTimeout(() => onClose(), 800);
    } catch (err: any) {
      setAuthError(err?.message || (activeTab === 'signup' ? 'تعذر إنشاء الحساب عبر معرف تليجرام' : 'تعذر الدخول عبر معرف تليجرام'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative bg-white dark:bg-[#0d1424] rounded-3xl max-w-md w-full p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-2xl animate-in zoom-in-95 duration-200">
        
        {/* زر الإغلاق */}
        <button
          onClick={onClose}
          className="absolute left-4 top-4 p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
        >
          <X className="w-4 h-4" />
        </button>

        {/* العنوان والشعار */}
        <div className="text-center mb-5">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mx-auto mb-2 text-amber-500 font-black text-xl">
            ط
          </div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white">
            منصة طرقع للكمي
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            سجل دخولك لتتبع درجاتك وتحليل نقاط ضعفك
          </p>
        </div>

        {/* محول التبويب */}
        <div className="flex rounded-xl bg-slate-100 dark:bg-slate-900/80 p-1 mb-5 border border-slate-200/60 dark:border-slate-800">
          <button
            type="button"
            onClick={() => { setActiveTab('signin'); setAuthError(null); setAuthSuccess(null); }}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'signin'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            تسجيل الدخول
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('signup'); setAuthError(null); setAuthSuccess(null); }}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'signup'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            حساب جديد
          </button>
        </div>

        {/* تنبيهات الخطأ والنجاح */}
        {authError && (
          <div className="mb-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{authError}</span>
          </div>
        )}

        {authSuccess && (
          <div className="mb-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{authSuccess}</span>
          </div>
        )}

        {/* قسم تليجرام الرسمي (@Tarqa3bot) - لتسجيل الدخول وإنشاء الحساب */}
        <div className="mb-4 p-3.5 rounded-2xl bg-gradient-to-b from-[#24A1DE]/10 to-[#24A1DE]/5 border border-[#24A1DE]/25">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-[#24A1DE] flex items-center justify-center text-white shadow-sm">
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.161c-.18.872-1.748 7.375-2.544 10.725-.337 1.417-.98 1.69-1.603 1.636-.889-.078-1.564-.747-2.428-1.312-1.353-.886-2.116-1.438-3.428-2.302-1.516-.998-.533-1.547.331-2.444.226-.235 4.148-3.805 4.225-4.13.01-.04.018-.19-.071-.271-.09-.081-.223-.053-.319-.032-.136.031-2.303 1.464-6.5 4.301-.615.422-1.171.628-1.669.617-.55-.012-1.608-.312-2.395-.568-.964-.313-1.731-.478-1.664-1.009.035-.277.417-.56 1.144-.851 4.485-1.954 7.477-3.243 8.977-3.865 4.279-1.776 5.168-2.086 5.75-2.096.128-.002.414.03.6.182.156.128.2.302.221.424-.002.094.01.378-.006.564z"/>
                </svg>
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  {activeTab === 'signup' ? 'إنشاء حساب فوري عبر تليجرام' : 'الدخول السريع عبر تليجرام'}
                </h3>
                <a 
                  href={TELEGRAM_BOT_URL} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-[10px] text-[#24A1DE] hover:underline flex items-center gap-0.5 font-mono"
                >
                  <span>@{TELEGRAM_BOT_USERNAME}</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
            </div>

            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#24A1DE]/20 text-[#24A1DE] font-semibold">
              بوت معتمد
            </span>
          </div>

          {/* ويدجت تليجرام الرسمي من تيليجرام */}
          <div className="flex flex-col items-center justify-center my-2">
            <div ref={telegramContainerRef} className="min-h-[40px] flex items-center justify-center" />
          </div>

          {/* خيار الدخول / إنشاء الحساب بالمعرّف المباشر */}
          {!showTelegramDirectInput ? (
            <button
              type="button"
              onClick={() => setShowTelegramDirectInput(true)}
              className="w-full text-center text-[11px] text-slate-500 hover:text-[#24A1DE] transition py-1 flex items-center justify-center gap-1"
            >
              <AtSign className="w-3 h-3" />
              <span>
                {activeTab === 'signup' ? 'أو إنشاء الحساب باليوزر / المعرف مباشرة' : 'أو الدخول المباشر باليوزر / المعرف'}
              </span>
            </button>
          ) : (
            <div className="mt-2.5 pt-2 border-t border-[#24A1DE]/20 space-y-2 animate-in fade-in-50 duration-150">
              <div className="relative">
                <input
                  type="text"
                  value={telegramHandle}
                  onChange={(e) => setTelegramHandle(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleDirectTelegramLogin()}
                  placeholder="اكتب يوزرك مثلاً: username@"
                  dir="ltr"
                  className="w-full pr-8 pl-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-[#24A1DE]/40 text-left font-mono"
                />
                <AtSign className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5" />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleDirectTelegramLogin}
                  disabled={isLoading}
                  className="flex-1 py-2 px-3 rounded-xl bg-[#24A1DE] hover:bg-[#208fcf] text-white font-bold text-xs shadow-sm transition flex items-center justify-center gap-1"
                >
                  {isLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : activeTab === 'signup' ? (
                    <Sparkles className="w-3.5 h-3.5" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {activeTab === 'signup' ? 'إنشاء حساب فوري باليوزر' : 'دخول فوري باليوزر'}
                  </span>
                </button>
                <a
                  href={TELEGRAM_BOT_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold transition flex items-center gap-1"
                  title="فتح المحادثة مع البوت في تليجرام"
                >
                  <span>البوت</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          )}
        </div>

        {/* فاصل بين خيارات تليجرام والبريد الإلكتروني */}
        <div className="flex items-center gap-2 my-3">
          <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
          <span className="text-[10px] text-slate-400 font-medium">
            {activeTab === 'signup' ? 'أو التسجيل بالبريد الإلكتروني' : 'أو بالبريد الإلكتروني'}
          </span>
          <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
        </div>

        {/* فورم تسجيل الدخول بالبريد */}
        {activeTab === 'signin' && (
          <form onSubmit={handleSignInSubmit(onSignIn)} className="space-y-3">
            <div>
              <div className="relative">
                <input
                  type="email"
                  placeholder="البريد الإلكتروني"
                  {...registerSignIn('email')}
                  className="w-full pr-9 pl-4 py-2 rounded-xl border text-xs bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                />
                <Mail className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5" />
              </div>
              {signInErrors.email && <p className="text-[10px] text-rose-500 mt-1">{signInErrors.email.message}</p>}
            </div>

            <div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="كلمة المرور"
                  {...registerSignIn('password')}
                  className="w-full pr-9 pl-9 py-2 rounded-xl border text-xs bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                />
                <Lock className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-2.5 text-slate-400"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
              {signInErrors.password && <p className="text-[10px] text-rose-500 mt-1">{signInErrors.password.message}</p>}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-sm transition flex items-center justify-center gap-1.5"
            >
              {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 fill-current" />}
              <span>تسجيل الدخول</span>
            </button>
          </form>
        )}

        {/* فورم إنشاء الحساب */}
        {activeTab === 'signup' && (
          <form onSubmit={handleSignUpSubmit(onSignUp)} className="space-y-3">
            <div>
              <div className="relative">
                <input
                  type="text"
                  placeholder="الاسم الكامل"
                  {...registerSignUp('fullName')}
                  className="w-full pr-9 pl-4 py-2 rounded-xl border text-xs bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                />
                <User className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5" />
              </div>
              {signUpErrors.fullName && <p className="text-[10px] text-rose-500 mt-1">{signUpErrors.fullName.message}</p>}
            </div>

            <div>
              <div className="relative">
                <input
                  type="email"
                  placeholder="البريد الإلكتروني"
                  {...registerSignUp('email')}
                  className="w-full pr-9 pl-4 py-2 rounded-xl border text-xs bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                />
                <Mail className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5" />
              </div>
              {signUpErrors.email && <p className="text-[10px] text-rose-500 mt-1">{signUpErrors.email.message}</p>}
            </div>

            <div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="كلمة المرور (6 خانات+)"
                  {...registerSignUp('password')}
                  className="w-full pr-9 pl-9 py-2 rounded-xl border text-xs bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                />
                <Lock className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-2.5 text-slate-400"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
              {signUpErrors.password && <p className="text-[10px] text-rose-500 mt-1">{signUpErrors.password.message}</p>}
            </div>

            {/* يوزر تليجرام الاختياري */}
            <div>
              <div className="relative">
                <input
                  type="text"
                  placeholder="يوزر تليجرام (اختياري) مثل: username@"
                  {...registerSignUp('telegramUsername')}
                  dir="ltr"
                  className="w-full pr-9 pl-4 py-2 rounded-xl border text-xs bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/30 font-mono text-left"
                />
                <AtSign className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5" />
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">لتلقي تقارير نتائج اختباراتك عبر @{TELEGRAM_BOT_USERNAME}</p>
            </div>

            <div>
              <div className="flex items-center justify-between text-[11px] mb-1">
                <span className="text-slate-500">الدرجة المستهدفة:</span>
                <span className="font-bold text-amber-500 font-mono">
                  {currentTargetScore === 100 ? '100 🎯' : '+' + currentTargetScore}
                </span>
              </div>
              <input
                type="range"
                min="50"
                max="100"
                {...registerSignUp('targetScore', { valueAsNumber: true })}
                className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg accent-amber-500 cursor-pointer"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-sm transition flex items-center justify-center gap-1.5"
            >
              {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              <span>ابدأ رحلة الـ 100 الآن 🎯</span>
            </button>
          </form>
        )}

        {/* حالة الاتصال الذكية */}
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px]">
          <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
            <span className={`w-2 h-2 rounded-full inline-block ${authService.isConfigured() ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
            <span>
              {authService.isConfigured()
                ? 'متصل بقاعدة Supabase'
                : 'تسجيل ودخول فوري مفعّل'}
            </span>
          </span>
          <a
            href={TELEGRAM_BOT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#24A1DE] hover:underline font-mono text-[10px] flex items-center gap-1"
          >
            <span>@{TELEGRAM_BOT_USERNAME}</span>
            <ExternalLink className="w-2.5 h-2.5" />
          </a>
        </div>

      </div>
    </div>
  );
};
