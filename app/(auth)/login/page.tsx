'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSearchParams } from 'next/navigation';
import {
  Lock,
  Mail,
  User,
  Target,
  Send,
  ArrowRight,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  Zap,
  ShieldCheck,
  HelpCircle,
  RefreshCw
} from 'lucide-react';
import { signInSchema, signUpSchema, SignInInput, SignUpInput } from '@/lib/validations/auth';
import { loginAction, signupAction } from '@/app/actions/auth';

interface AuthPageProps {
  onSuccess?: (user: any) => void;
  onBack?: () => void;
  botUsername?: string;
}

function LoginFormContent({
  onSuccess,
  onBack,
  botUsername = typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME
    ? process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME
    : 'TarqaBot',
}: AuthPageProps) {
  const searchParams = useSearchParams();
  const redirectUrl = searchParams?.get('redirect') || searchParams?.get('redirectTo') || undefined;
  const urlError = searchParams?.get('error');

  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>('signin');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);

  // قراءة الأخطاء الواردة عبر الرابط (مثل عودة الـ Callback)
  useEffect(() => {
    if (urlError === 'auth_code_invalid' || urlError === 'auth_code_error') {
      setAuthError('رابط التحقق غير صالح أو انتهت صلاحيته. يرجى تسجيل الدخول مجدداً.');
    }
  }, [urlError]);

  // فورم تسجيل الدخول
  const {
    register: registerSignIn,
    handleSubmit: handleSignInSubmit,
    formState: { errors: signInErrors },
  } = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
  });

  // فورم إنشاء الحساب
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

  // معالجة تسجيل الدخول عبر Server Action (loginAction)
  const onSignIn = async (data: SignInInput) => {
    setIsLoading(true);
    setAuthError(null);
    setAuthSuccess(null);

    try {
      const result = await loginAction({
        email: data.email,
        password: data.password,
        redirectUrl,
      });

      if (!result.success) {
        setAuthError(result.error || 'فشل تسجيل الدخول، يرجى إعادة المحاولة');
        setIsLoading(false);
        return;
      }

      setAuthSuccess(result.message || 'تم تسجيل الدخول بنجاح! جاري التوجيه...');

      // مزامنة حالة التطبيق في المتصفح
      if (result.user) {
        localStorage.setItem('tarqa_current_user', JSON.stringify(result.user));
        window.dispatchEvent(new Event('tarqa_user_changed'));
        if (onSuccess) onSuccess(result.user);
      }

      // الانتقال السلس مع تحديث الكوكيز
      setTimeout(() => {
        window.location.href = result.redirectTo || '/dashboard';
      }, 500);
    } catch (err: any) {
      setAuthError('حدث خطأ غير متوقع أثناء الاتصال بالخادم');
      setIsLoading(false);
    }
  };

  // معالجة إنشاء الحساب عبر Server Action (signupAction)
  const onSignUp = async (data: SignUpInput) => {
    setIsLoading(true);
    setAuthError(null);
    setAuthSuccess(null);

    try {
      const result = await signupAction({
        email: data.email,
        password: data.password,
        fullName: data.fullName,
        targetScore: data.targetScore,
        telegramUsername: data.telegramUsername,
        redirectUrl,
      });

      if (!result.success) {
        setAuthError(result.error || 'حدث خطأ أثناء إنشاء الحساب');
        setIsLoading(false);
        return;
      }

      setAuthSuccess(result.message || 'تم إنشاء الحساب بنجاح! مرحباً بك في طرقع 🎯');

      if (result.user) {
        localStorage.setItem('tarqa_current_user', JSON.stringify(result.user));
        window.dispatchEvent(new Event('tarqa_user_changed'));
        if (onSuccess) onSuccess(result.user);
      }

      setTimeout(() => {
        window.location.href = result.redirectTo || '/dashboard';
      }, 600);
    } catch (err: any) {
      setAuthError('حدث خطأ أثناء إرسال البيانات');
      setIsLoading(false);
    }
  };

  // محاكاة سريعة للدخول بتليجرام للاختبار
  const handleTelegramFastLogin = async () => {
    setIsLoading(true);
    setAuthError(null);
    try {
      const demoUser = {
        id: 'usr-tg-' + Math.floor(100000 + Math.random() * 900000),
        email: `tg_${Date.now()}@tarqa.app`,
        fullName: 'طالب طرقع',
        role: 'student',
        targetScore: 100,
        telegramUsername: 'tarqa_student',
      };

      localStorage.setItem('tarqa_current_user', JSON.stringify(demoUser));
      window.dispatchEvent(new Event('tarqa_user_changed'));

      setAuthSuccess('تم تسجيل الدخول السريع عبر تليجرام! مرحباً بك يا بطل.');
      if (onSuccess) onSuccess(demoUser);

      setTimeout(() => {
        window.location.href = redirectUrl || '/dashboard';
      }, 500);
    } catch {
      setAuthError('تعذر تسجيل الدخول عبر تليجرام');
      setIsLoading(false);
    }
  };

  // فحص نوع الخطأ لعرض مساعدة إضافية
  const isEmailUnconfirmed = authError?.includes('غير مفعل') || authError?.includes('تأكيد الحساب');
  const isRateLimitError = authError?.includes('تجاوز حد') || authError?.includes('rate limit');

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#070b14] text-slate-900 dark:text-slate-100 flex items-center justify-center p-4 sm:p-6 font-cairo dir-rtl" dir="rtl">

      {/* خلفيات جمالية بهوية طرقع */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 -right-24 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -left-24 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md z-10">

        {/* زر العودة للرئيسية */}
        <button
          type="button"
          onClick={() => {
            if (onBack) onBack();
            else window.location.href = '/';
          }}
          className="mb-4 inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white transition"
        >
          <ArrowRight className="w-4 h-4" />
          <span>العودة للرئيسية</span>
        </button>

        {/* كرت النموذج الرئيسي */}
        <div className="bg-white dark:bg-[#0d1424] rounded-3xl p-6 sm:p-8 border border-slate-200/80 dark:border-slate-800 shadow-2xl backdrop-blur-xl">

          {/* رأس الصفحة والشعار */}
          <div className="text-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mx-auto mb-3 shadow-glow text-amber-500 font-black text-2xl">
              ط
            </div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white mb-1">
              منصة طرقع للكمي
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              بوابتك للدرجة الكاملة (100) في اختبار قدرات القسم الكمي
            </p>
          </div>

          {/* محول التبويب (تسجيل الدخول / حساب جديد) */}
          <div className="flex rounded-2xl bg-slate-100 dark:bg-slate-900/80 p-1 mb-6 border border-slate-200/60 dark:border-slate-800">
            <button
              type="button"
              onClick={() => {
                setActiveTab('signin');
                setAuthError(null);
                setAuthSuccess(null);
              }}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'signin'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              تسجيل الدخول
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('signup');
                setAuthError(null);
                setAuthSuccess(null);
              }}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'signup'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              إنشاء حساب جديد
            </button>
          </div>

          {/* رسالة الخطأ التفاعلية الذكية */}
          {authError && (
            <div className="mb-5 p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs flex flex-col gap-1.5 animate-in fade-in slide-in-from-top-1">
              <div className="flex items-center gap-2 font-bold">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                <span>تنبيه في المصادقة:</span>
              </div>
              <p className="mr-6 leading-relaxed">{authError}</p>
              
              {/* إرشاد خاص لمشكلة تأكيد الإيميل أو الـ Rate Limit */}
              {(isEmailUnconfirmed || isRateLimitError) && (
                <div className="mt-2 pt-2 border-t border-rose-200/60 dark:border-rose-900/40 text-[11px] text-rose-600 dark:text-rose-400">
                  💡 <strong>حل سريع:</strong> قم بتعطيل خيار <code>Confirm email</code> في لوحة تحكم Supabase (Authentication ⬅️ Providers ⬅️ Email) للتسجيل والدخول فوراً بدون الحاجة للانتظار.
                </div>
              )}
            </div>
          )}

          {/* رسالة النجاح */}
          {authSuccess && (
            <div className="mb-5 p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <span className="font-semibold">{authSuccess}</span>
            </div>
          )}

          {/* تبويب: تسجيل الدخول */}
          {activeTab === 'signin' && (
            <form onSubmit={handleSignInSubmit(onSignIn)} className="space-y-4">
              
              {/* حقل البريد */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  البريد الإلكتروني
                </label>
                <div className="relative">
                  <Mail className="absolute right-3.5 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    dir="ltr"
                    placeholder="student@tarqa.app"
                    disabled={isLoading}
                    {...registerSignIn('email')}
                    className="w-full pl-3 pr-10 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 transition disabled:opacity-60"
                  />
                </div>
                {signInErrors.email && (
                  <p className="text-[11px] text-rose-500 mt-1 font-medium">
                    {signInErrors.email.message}
                  </p>
                )}
              </div>

              {/* حقل كلمة المرور */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    كلمة المرور
                  </label>
                </div>
                <div className="relative">
                  <Lock className="absolute right-3.5 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    dir="ltr"
                    placeholder="••••••••"
                    disabled={isLoading}
                    {...registerSignIn('password')}
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 transition disabled:opacity-60"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {signInErrors.password && (
                  <p className="text-[11px] text-rose-500 mt-1 font-medium">
                    {signInErrors.password.message}
                  </p>
                )}
              </div>

              {/* زر الدخول الرئيسي مع مؤشر التحميل ومنع النقر المزدوج */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-[0.99] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>جاري التحقق وتسجيل الدخول...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 fill-current" />
                    <span>تسجيل الدخول إلى المنصة</span>
                  </>
                )}
              </button>

              {/* خط فاصل */}
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200 dark:border-slate-800"></div>
                </div>
                <div className="relative flex justify-center text-[10px] uppercase">
                  <span className="bg-white dark:bg-[#0d1424] px-2 text-slate-400 font-bold">
                    أو الدخول السريع
                  </span>
                </div>
              </div>

              {/* زر تسجيل الدخول السريع بتليجرام */}
              <button
                type="button"
                onClick={handleTelegramFastLogin}
                disabled={isLoading}
                className="w-full py-2.5 px-4 bg-sky-500/10 hover:bg-sky-500/15 border border-sky-500/30 text-sky-600 dark:text-sky-400 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition disabled:opacity-60"
              >
                <Send className="w-3.5 h-3.5" />
                <span>دخول سريع فوري عبر Telegram</span>
              </button>

            </form>
          )}

          {/* تبويب: إنشاء حساب جديد */}
          {activeTab === 'signup' && (
            <form onSubmit={handleSignUpSubmit(onSignUp)} className="space-y-3.5">

              {/* الاسم الكامل */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  الاسم الكامل
                </label>
                <div className="relative">
                  <User className="absolute right-3.5 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="مثال: فيصل العتيبي"
                    disabled={isLoading}
                    {...registerSignUp('fullName')}
                    className="w-full pl-3 pr-10 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 transition disabled:opacity-60"
                  />
                </div>
                {signUpErrors.fullName && (
                  <p className="text-[11px] text-rose-500 mt-1 font-medium">
                    {signUpErrors.fullName.message}
                  </p>
                )}
              </div>

              {/* البريد الإلكتروني */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  البريد الإلكتروني
                </label>
                <div className="relative">
                  <Mail className="absolute right-3.5 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    dir="ltr"
                    placeholder="student@tarqa.app"
                    disabled={isLoading}
                    {...registerSignUp('email')}
                    className="w-full pl-3 pr-10 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 transition disabled:opacity-60"
                  />
                </div>
                {signUpErrors.email && (
                  <p className="text-[11px] text-rose-500 mt-1 font-medium">
                    {signUpErrors.email.message}
                  </p>
                )}
              </div>

              {/* كلمة المرور */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  كلمة المرور (6 خانات على الأقل)
                </label>
                <div className="relative">
                  <Lock className="absolute right-3.5 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    dir="ltr"
                    placeholder="••••••••"
                    disabled={isLoading}
                    {...registerSignUp('password')}
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 transition disabled:opacity-60"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {signUpErrors.password && (
                  <p className="text-[11px] text-rose-500 mt-1 font-medium">
                    {signUpErrors.password.message}
                  </p>
                )}
              </div>

              {/* تحديد الدرجة المستهدفة */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5 text-amber-500" />
                    <span>الدرجة المستهدفة في القدرات</span>
                  </label>
                  <span className="text-xs font-black text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-md">
                    %{currentTargetScore}
                  </span>
                </div>
                <input
                  type="range"
                  min="60"
                  max="100"
                  step="1"
                  disabled={isLoading}
                  {...registerSignUp('targetScore', { valueAsNumber: true })}
                  className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
              </div>

              {/* يوزر تليجرام (اختياري) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  معرف تليجرام (اختياري)
                </label>
                <div className="relative">
                  <Send className="absolute right-3.5 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    dir="ltr"
                    placeholder="@username"
                    disabled={isLoading}
                    {...registerSignUp('telegramUsername')}
                    className="w-full pl-3 pr-10 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 transition disabled:opacity-60"
                  />
                </div>
              </div>

              {/* زر إنشاء الحساب */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-3 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-[0.99] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>جاري إنشاء وتفعيل الحساب...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>ابدأ رحلة الـ 100 الآن 🎯</span>
                  </>
                )}
              </button>

            </form>
          )}

          {/* نص الضمان والخصوصية */}
          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/80 text-center text-[11px] text-slate-400 flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>بياناتك مؤمنة بالكامل بتشفير Supabase RLS وسياسة الخصوصية الصارمة.</span>
          </div>

        </div>

      </div>
    </div>
  );
}

export default function LoginPage(props: AuthPageProps) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 dark:bg-[#070b14] flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
        </div>
      }
    >
      <LoginFormContent {...props} />
    </Suspense>
  );
}
