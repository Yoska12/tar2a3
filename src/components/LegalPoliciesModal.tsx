import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Lock, 
  Cookie, 
  RotateCcw, 
  FileText, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  HelpCircle,
  ExternalLink,
  ChevronRight,
  Printer
} from 'lucide-react';
import { TELEGRAM_BOT_URL, TELEGRAM_BOT_USERNAME } from '../lib/telegram';

export type PolicyTab = 'terms' | 'privacy' | 'cookies' | 'refund';

interface LegalPoliciesModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: PolicyTab;
}

export const LegalPoliciesModal: React.FC<LegalPoliciesModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'terms',
}) => {
  const [activeTab, setActiveTab] = useState<PolicyTab>(initialTab);

  React.useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab, isOpen]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="relative bg-white dark:bg-[#0c1324] border border-slate-200 dark:border-slate-800 w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden flex flex-col my-6 max-h-[90vh] animate-in zoom-in-95 duration-200">
        
        {/* رأس النافذة */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-amber-500/10 via-blue-500/5 to-transparent border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/15 text-amber-500 flex items-center justify-center font-black">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span>الوثيقة القانونية وسياسات المنصة</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 font-bold">
                  محدثة {new Date().getFullYear()}
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                منصة طرقع لاختبارات وتأسيس القدرات العامة • التزام تام بالشفافية وحماية الطلاب
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handlePrint}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              title="طباعة الوثيقة"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              title="إغلاق النافذة"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* شريط التبويبات الأربعة */}
        <div className="flex items-center gap-1 p-2 bg-slate-50 dark:bg-slate-900/70 border-b border-slate-200 dark:border-slate-800 overflow-x-auto scrollbar-none shrink-0 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('terms')}
            className={`flex-1 min-w-[120px] py-2.5 px-3 rounded-xl font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
              activeTab === 'terms'
                ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>شروط الاستخدام</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('privacy')}
            className={`flex-1 min-w-[120px] py-2.5 px-3 rounded-xl font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
              activeTab === 'privacy'
                ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>سياسة الخصوصية</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('cookies')}
            className={`flex-1 min-w-[120px] py-2.5 px-3 rounded-xl font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
              activeTab === 'cookies'
                ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Cookie className="w-3.5 h-3.5" />
            <span>ملفات الكوكيز</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('refund')}
            className={`flex-1 min-w-[120px] py-2.5 px-3 rounded-xl font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
              activeTab === 'refund'
                ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>سياسة الاسترجاع</span>
          </button>
        </div>

        {/* محتوى السياسة القابل للتمرير */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-8 space-y-6 text-slate-700 dark:text-slate-300 text-xs sm:text-sm leading-relaxed">
          
          {/* ================================================================= */}
          {/* 1. شروط وسياسة الاستخدام */}
          {/* ================================================================= */}
          {activeTab === 'terms' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="font-black text-amber-900 dark:text-amber-300">
                    مرحباً بك في منصة طرقع للقدرات
                  </h4>
                  <p className="text-xs text-amber-800/90 dark:text-amber-200/90">
                    باستخدامك للمنصة أو إنشائك لحساب أو اشتراكك في باقات التأسيس والمحاضرات، فإنك توافق على الالتزام الكامل بهذه الشروط والأحكام.
                  </p>
                </div>
              </div>

              <section className="space-y-2">
                <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span>1. طبيعة الخدمة وأهلية الاستخدام</span>
                </h3>
                <p>
                  منصة <strong>طرقع</strong> هي منصة تعليمية وتدريبية متخصصة تهدف إلى تأهيل طلاب وطالبات المرحلة الثانوية لاختبار القدرات العامة (القسم الكمي والتأسيس الشامل) من خلال بنك أسئلة ذكي، ومحاضرات مسجلة، ومذكرات بصيغة PDF، ونظام محاكاة الاختبارات الوزارية. الخدمة متاحة للطلاب والمعلمين للاستخدام الشخصي التعليمي فقط.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span>2. أمان الحساب وحظر المشاركة (Non-Sharing Policy)</span>
                </h3>
                <ul className="list-disc list-inside space-y-1.5 text-xs sm:text-sm pr-2">
                  <li>كل حساب مسجل مخصص لشخص واحد فقط ولا يجوز مشاركة بيانات تسجيل الدخول مع أي أطراف أخرى.</li>
                  <li>تستخدم المنصة نظاماً تقنياً ذكياً لتتبع الجلسات المتزامنة ومكافحة التسريب؛ وفي حال رصد تشغيل الحساب على أجهزة متعددة متزامنة خارج النطاق الطبيعي، يحق للمنصة تجميد الحساب للحماية.</li>
                  <li>يتحمل الطالب المسؤولية الكاملة عن الحفاظ على سرية كلمة المرور وبيانات حسابه.</li>
                </ul>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span>3. الملكية الفكرية والعلامة المائية الرقمية</span>
                </h3>
                <p>
                  كافة المحتويات المنشورة على المنصة — بما يشمل الأسئلة، الشروحات، مقاطع الفيديو، المذكرات، الخرائط الذهنية، والتصميمات البرمجية — محمية بموجب قوانين الملكية الفكرية وحقوق النشر.
                </p>
                <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs">
                  <span className="font-bold text-slate-900 dark:text-white">🛡️ العلامة المائية المانعة للتسريب:</span>
                  <span className="block text-slate-500 dark:text-slate-400 mt-1">
                    يتم تضمين علامات مائية ديناميكية مشفرة على مقاطع الفيديو والمذكرات لربط المحتوى ببيانات المشاهد لمنع إعادة نشر المحتوى تجارياً أو رفعه على منصات خارجية دون إذن رسمي مكتوب.
                  </span>
                </div>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span>4. الاشتراكات والرسوم المعتمدة</span>
                </h3>
                <p>
                  قيمة الاشتراك السنوي الموحد لمسار التأسيس الشامل ومكتبة المحاضرات والمذكرات هي:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 font-bold text-center">
                    🇸🇦 75 ريال سعودي سنوياً (مدى / فيزا / ماستركارد)
                  </div>
                  <div className="p-3 rounded-2xl bg-blue-500/10 border border-blue-500/30 font-bold text-center">
                    🇪🇬 1020 جنيه مصري سنوياً (فودافون كاش / إنستاباي / ميزة)
                  </div>
                </div>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span>5. إخلاء المسؤولية التعليمية</span>
                </h3>
                <p>
                  تهدف المنصة إلى تقديم أعلى جودة تدريبية وأحدث التجميعات المتطابقة مع قياس. ومع ذلك، فإن النتيجة النهائية للطالب في اختبار القدرات تعتمد على جهده وممارسته الشخصية واستعداده الفردي.
                </p>
              </section>
            </div>
          )}

          {/* ================================================================= */}
          {/* 2. سياسة الخصوصية وحماية البيانات */}
          {/* ================================================================= */}
          {activeTab === 'privacy' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-start gap-3">
                <Lock className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="font-black text-blue-900 dark:text-blue-300">
                    خصوصيتك وأمان بياناتك على رأس أولوياتنا
                  </h4>
                  <p className="text-xs text-blue-800/90 dark:text-blue-200/90">
                    نحن في منصة طرقع نلتزم بأعلى معايير حماية البيانات الشخصية والأمان السيبراني. لا نقوم إطلاقاً ببيع أو تأجير بياناتك لأي جهة إعلانية أو تجارية.
                  </p>
                </div>
              </div>

              <section className="space-y-2">
                <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  <span>1. البيانات التي نجمعها</span>
                </h3>
                <ul className="list-disc list-inside space-y-1.5 text-xs sm:text-sm pr-2">
                  <li><strong>بيانات الحساب الأساسية:</strong> الاسم الكامل، البريد الإلكتروني، ومعرف التيليجرام الاختياري لتلقي تقارير الاختبارات.</li>
                  <li><strong>البيانات الأكاديمية والتدريبية:</strong> الدرجة المستهدفة، إحصائيات الاختبارات المنجزة، نقاط القوة والضعف في الأقسام، وسجل الإجابات لمساعدتك في المراجعة.</li>
                  <li><strong>البيانات التقنية التشغيلية:</strong> نوع المتصفح، عنوان الـ IP المشفر للأمان، وبيانات الجلسة لضمان استمرار الدخول دون انقطاع.</li>
                </ul>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  <span>2. أمان المعاملات المالية ومعلومات الدفع</span>
                </h3>
                <p>
                  تتم كافة عمليات الدفع الإلكتروني عبر بوابة الدفع المعتمدة <strong>كاشير (Kashier Payment Gateway)</strong> الحاصلة على أعلى معايير الأمان العالمية <strong>PCI-DSS Level 1</strong>.
                </p>
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-xs space-y-1.5">
                  <div className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>حماية مصرفية 100% بدون تخزين بطاقات:</span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                    منصة طرقع <strong>لا تطّلع ولا تحفظ إطلاقاً</strong> أرقام بطاقاتك الائتمانية أو رموز الـ CVV أو الحسابات البنكية. تتم معالجة بيانات البطاقة بشكل مشفر داخل إطار كاشير البنكي المباشر.
                  </p>
                </div>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  <span>3. تشفير البيانات والتخزين السحابي</span>
                </h3>
                <p>
                  يتم تخزين بيانات الطلاب في خوادم سحابية محمية ومستضافة عبر <strong>Supabase</strong> بتشفير كامل (SSL/TLS 256-bit) لضمان عزل البيانات وحمايتها من أي وصول غير مصرح به.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  <span>4. حقوق الطالب والتحكم في حسابه</span>
                </h3>
                <p>
                  يحق لك في أي وقت تعديل بياناتك الشخصية، أو طلب تقرير بأدائك التعليمي، أو طلب حذف حسابك وبياناتك نهائياً من قاعدة البيانات عبر التواصل مع فريق الدعم الفني.
                </p>
              </section>
            </div>
          )}

          {/* ================================================================= */}
          {/* 3. سياسة ملفات تعريف الارتباط (Cookie Policy) */}
          {/* ================================================================= */}
          {activeTab === 'cookies' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
                <Cookie className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="font-black text-amber-900 dark:text-amber-300">
                    كيف نستخدم ملفات الكوكيز والتخزين المحلي؟
                  </h4>
                  <p className="text-xs text-amber-800/90 dark:text-amber-200/90">
                    تستخدم منصة طرقع ملفات تعريف الارتباط (Cookies) والتخزين المحلي (LocalStorage) لتقديم تجربة تصفح سريعة وآمنة ومخصصة لمستوى تدريبك.
                  </p>
                </div>
              </div>

              <section className="space-y-2">
                <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span>1. ما هي ملفات الكوكيز والتخزين المحلي؟</span>
                </h3>
                <p>
                  هي ملفات نصية وسجلات رقمية صغيرة الحجم يحفظها متصفحك على جهازك. تتيح للمنصة تذكر جلسة دخولك، حفظ تقدمك في منتصف الاختبار التدريبي في حال انقطاع اتصالك بالإنترنت، وحفظ تفضيل الوضع الليلي/النهاري.
                </p>
              </section>

              <section className="space-y-3">
                <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span>2. أنواع الملفات المستخدمة في منصة طرقع</span>
                </h3>

                <div className="space-y-2.5">
                  <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span>الملفات الضرورية للغاية (Essential Storage)</span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 font-bold">لا يمكن الاستغناء عنها</span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      مسؤولة عن التحقق من جلسة المستخدم (Supabase Token)، وتأمين الحساب، والتأكد من فتح المحاضرات المشترك بها بنجاح.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                      <span>ملفات الوظائف والتفضيلات (Functional Preferences)</span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      حفظ وضع المظهر الداكن أو الفاتح، سرعة الشرح المفضلة بالفيديو، وتفضيلات عرض الأسئلة.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                      <span>ملفات حفظ الاختبارات والتدريب دون اتصال (Offline Resilience)</span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      تخزين الإجابات مؤقتاً أثناء حل الاختبار التدريبي لمنع ضياع مجهود الطالب إذا انقطع الإنترنت فجأة.
                    </p>
                  </div>
                </div>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span>3. كيفية التحكم في ملفات تعريف الارتباط</span>
                </h3>
                <p>
                  يمكنك في أي وقت مسح أو حظر ملفات الكوكيز من إعدادات متصفحك (Chrome، Safari، Edge، إلخ). يرجى ملاحظة أن تعطيل التخزين الأساسي قد يؤدي لتسجيل الخروج التلقائي وحاجة الطالب لإعادة إدخال بياناته عند كل تحديث للصفحة.
                </p>
              </section>
            </div>
          )}

          {/* ================================================================= */}
          {/* 4. سياسة الاسترجاع والإلغاء */}
          {/* ================================================================= */}
          {activeTab === 'refund' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-3">
                <RotateCcw className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="font-black text-rose-900 dark:text-rose-300">
                    سياسة واضحة وعادلة للاشتراكات والاسترجاع
                  </h4>
                  <p className="text-xs text-rose-800/90 dark:text-rose-200/90">
                    نظراً لأن منصة طرقع تقدم محتوى رقمياً وتدريبياً يتم تفعيله فورياً (Instant Digital Access) فور إتمام الدفع، فإن سياسة الاسترجاع تخضع للضوابط التالية.
                  </p>
                </div>
              </div>

              <section className="space-y-2">
                <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  <span>1. طبيعة الخدمات الرقمية</span>
                </h3>
                <p>
                  بمجرد تأكيد الدفع الإلكتروني بنجاح، يتم فك تشفير كافة المحاضرات المغلقة، وإتاحة تحميل بنك المذكرات والملفات (PDF) فوراً. وبناءً على الأنظمة المعمول بها في خدمات المحتوى الرقمي الفوري، فإن الأصل هو عدم إمكانية استرجاع الاشتراك بعد بدء استهلاك وتحميل المحتوى، إلا في الحالات الاستثنائية الموضحة أدناه.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  <span>2. الحالات التي يحق فيها للطالب طلب استرجاع كامل للمبلغ:</span>
                </h3>
                <ul className="list-disc list-inside space-y-2 text-xs sm:text-sm pr-2">
                  <li>
                    <strong>حدوث خصم مكرر بالخطأ:</strong> في حال تم خصم الرسوم أكثر من مرة لنفس المعاملة بسبب ضغط الشبكة أو خطأ بوابة الدفع، يتم استرداد المبلغ المكرر فوراً بعد التحقق.
                  </li>
                  <li>
                    <strong>مشكلة فنية تقنية غير قابلة للحل:</strong> إذا واجه الطالب عطلاً تقنياً في حسابه يمنعه تماماً من الوصول للمحتوى ولم يتمكن فريق الدعم الفني من حله خلال 48 ساعة من الإبلاغ.
                  </li>
                  <li>
                    <strong>طلب الإلغاء قبل استهلاك المحتوى:</strong> إذا تواصل الطالب خلال 24 ساعة من الاشتراك دون أن يقوم بتحميل المذكرات أو مشاهدة المحاضرات المقفلة.
                  </li>
                </ul>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  <span>3. آلية ووقت استرداد الأموال</span>
                </h3>
                <p>
                  عند الموافقة على طلب الاسترجاع، يتم إعادة المبلغ لنفس وسيلة الدفع الأصلية (البطاقة الائتمانية أو المحفظة الإلكترونية) عبر بوابة كاشير. تستغرق دورة رد المبلغ عادة بين <strong>5 إلى 14 يوم عمل</strong>، حسب سياسة البنك الصادر منه بطاقة الطالب.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  <span>4. كيف تقدم طلب استرجاع أو استفسار؟</span>
                </h3>
                <p>
                  فريق دعم طرقع جاهز لمساعدتك وحل أي إشكالية عبر قنوات التواصل المباشرة:
                </p>
                <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 mt-2">
                  <div className="text-xs">
                    <span className="font-bold text-slate-900 dark:text-white block">الدعم الفني الرسمي على تليجرام:</span>
                    <span className="text-slate-400 font-mono">@{TELEGRAM_BOT_USERNAME}</span>
                  </div>
                  <a
                    href={TELEGRAM_BOT_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#24A1DE] text-white font-bold text-xs hover:bg-[#208fc4] transition"
                  >
                    <span>مراسلة الدعم الفني</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </section>
            </div>
          )}

        </div>

        {/* تذييل النافذة */}
        <div className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0 text-xs">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>كافة الحقوق محفوظة لمنصة طرقع التعليمية للقدرات العامة © {new Date().getFullYear()}</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-bold text-xs transition cursor-pointer"
          >
            فهمت وموافق
          </button>
        </div>

      </div>
    </div>
  );
};
