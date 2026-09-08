import React, { useState } from 'react';
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
  Zap
} from 'lucide-react';
import { signInSchema, signUpSchema, SignInInput, SignUpInput } from '../lib/validations/auth';
import { authService, TarqaUser } from '../lib/supabase';

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

  React.useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setAuthError(null);
      setAuthSuccess(null);
    }
  }, [isOpen, initialTab]);

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
          ? 'تم تسجيل الدخول بنجاح (الوضع الفوري النشط)! مرحباً بك.'
          : 'تم تسجيل الدخول بنجاح! مرحباً بك في طرقع.'
      );
      if (onUserLoggedIn) onUserLoggedIn(result.user);
      setTimeout(() => onClose(), 800);
    } catch (err: any) {
      setAuthError(err?.message || 'حدث خطأ أثناء تسجيل الدخول');
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
          : `تم إنشاء الحساب بنجاح في Supabase! هدفنا 100 🎯`
      );
      if (onUserLoggedIn) onUserLoggedIn(result.user);
      setTimeout(() => onClose(), 1000);
    } catch (err: any) {
      setAuthError(err?.message || 'حدث خطأ أثناء إنشاء الحساب');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTelegramFastLogin = () => {
    setIsLoading(true);
    setAuthError(null);
    setAuthSuccess(null);
    setTimeout(() => {
      try {
        const user = authService.signInWithTelegram({
          id: Math.floor(100000 + Math.random() * 900000),
          first_name: 'طالب',
          last_name: 'طرقع',
          username: 'tarqa_student',
        });
        setAuthSuccess('تم تسجيل الدخول السريع عبر Telegram! مرحباً بك يا بطل 🎯');
        if (onUserLoggedIn) onUserLoggedIn(user);
        setTimeout(() => onClose(), 700);
      } catch (err: any) {
        setAuthError(err?.message || 'تعذر تسجيل الدخول عبر تليجرام');
      } finally {
        setIsLoading(false);
      }
    }, 500);
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

        {/* زر تسجيل الدخول عبر تليجرام */}
        <button
          type="button"
          onClick={handleTelegramFastLogin}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#24A1DE] hover:bg-[#208fcf] text-white font-bold text-xs shadow-sm transition mb-4"
        >
          <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24">
            <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.161c-.18.872-1.748 7.375-2.544 10.725-.337 1.417-.98 1.69-1.603 1.636-.889-.078-1.564-.747-2.428-1.312-1.353-.886-2.116-1.438-3.428-2.302-1.516-.998-.533-1.547.331-2.444.226-.235 4.148-3.805 4.225-4.13.01-.04.018-.19-.071-.271-.09-.081-.223-.053-.319-.032-.136.031-2.303 1.464-6.5 4.301-.615.422-1.171.628-1.669.617-.55-.012-1.608-.312-2.395-.568-.964-.313-1.731-.478-1.664-1.009.035-.277.417-.56 1.144-.851 4.485-1.954 7.477-3.243 8.977-3.865 4.279-1.776 5.168-2.086 5.75-2.096.128-.002.414.03.6.182.156.128.2.302.221.424-.002.094.01.378-.006.564z"/>
          </svg>
          <span>الدخول السريع عبر Telegram</span>
        </button>

        <div className="flex items-center gap-2 my-3">
          <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
          <span className="text-[10px] text-slate-400 font-medium">أو بالبريد الإلكتروني</span>
          <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
        </div>

        {/* فورم تسجيل الدخول */}
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
          <span className="text-amber-500 font-bold font-mono">هدفنا 100 🎯</span>
        </div>

      </div>
    </div>
  );
};
