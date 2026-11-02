import React, { useState } from 'react';
import {
  Copy,
  Check,
  Zap,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  MessageCircle,
  Loader2,
  Lock,
  Sparkles,
  Smartphone,
  Info
} from 'lucide-react';
import { TarqaUser } from '../lib/supabase';
import { SUPPORT_PHONE_EGYPT_FORMATTED, SUPPORT_WHATSAPP_URL } from '../lib/constants';
import { sendTelegramMessage } from '../lib/telegram';

export interface InstaPayCheckoutProps {
  currentUser?: TarqaUser | null;
  amount?: number;
  currency?: string;
  onSuccess?: () => void;
  onClose?: () => void;
  className?: string;
}

export const InstaPayCheckout: React.FC<InstaPayCheckoutProps> = ({
  currentUser,
  amount = 1100, // السعر المعتمد للباقة السنوية
  currency = 'EGP',
  onSuccess,
  onClose,
  className = '',
}) => {
  // بيانات حساب إنستاباي الرسمي للمنصة
  const instapayIPA = 'yoska1@instapay';
  const instapayPhone = SUPPORT_PHONE_EGYPT_FORMATTED; // 01104687320
  const receiverName = 'YASSIEN';

  // حالات النسخ
  const [copiedIPA, setCopiedIPA] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);

  // حقول نموذج التأكيد
  const [senderNameOrPhone, setSenderNameOrPhone] = useState(
    (currentUser as any)?.phone || currentUser?.fullName || ''
  );
  const [referenceCode, setReferenceCode] = useState('');
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [receiptFileName, setReceiptFileName] = useState<string>('');

  // حالات التقديم والتحميل
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  /**
   * نسخ النصوص إلى الحافظة
   */
  const handleCopy = (text: string, type: 'ipa' | 'phone') => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(text);
      if (type === 'ipa') {
        setCopiedIPA(true);
        setTimeout(() => setCopiedIPA(false), 2000);
      } else {
        setCopiedPhone(true);
        setTimeout(() => setCopiedPhone(false), 2000);
      }
    }
  };

  /**
   * معالجة رفع صورة الإيصال
   */
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg('يرجى اختيار ملف صورة صالح (JPG, PNG, WebP)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('حجم الصورة كبير جداً، يرجى اختيار صورة أقل من 5 ميجابايت');
      return;
    }

    setReceiptFileName(file.name);
    setErrorMsg(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      setReceiptImage(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  /**
   * تسجيل بيانات التحويل وإشعار الدعم الفني (بدون تفعيل تلقائي)
   */
  const handleConfirmTransfer = async () => {
    if (!senderNameOrPhone.trim()) {
      setErrorMsg('يرجى كتابة اسم صاحب الحساب المحول منه أو رقم هاتفه لتسجيل التحويل');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const student = currentUser || {
        id: 'instapay_' + Date.now(),
        email: 'student_' + Date.now() + '@tarqa3.net',
        fullName: senderNameOrPhone.trim(),
        role: 'student',
      } as TarqaUser;

      // 1. حفظ سجل المعاملة محلياً بحالة "قيد مراجعة الدعم الفني"
      const transferRecord = {
        id: `INSTA_${Date.now()}`,
        type: 'INSTAPAY',
        amount,
        currency,
        sender: senderNameOrPhone.trim(),
        referenceCode: referenceCode.trim() || 'N/A',
        studentId: student.id,
        studentEmail: student.email,
        studentName: student.fullName,
        receiptAttached: Boolean(receiptImage),
        date: new Date().toISOString(),
        status: 'PENDING_SUPPORT_CONFIRMATION',
      };

      try {
        const existingTransfers = JSON.parse(localStorage.getItem('tarqa_instapay_transfers') || '[]');
        existingTransfers.unshift(transferRecord);
        localStorage.setItem('tarqa_instapay_transfers', JSON.stringify(existingTransfers));
      } catch (storageErr) {
        console.warn('Storage error:', storageErr);
      }

      // 2. إرسال إشعار فوري لإدارة المنصة عبر تليجرام
      try {
        const adminTelegramMsg = `
⚡ <b>طلب اشتراك جديد عبر إنستاباي (بانتظار المراجعة)</b>
👤 الطالب: <b>${student.fullName || 'غير محدد'}</b>
📧 البريد: <b>${student.email || 'غير محدد'}</b>
💰 المبلغ: <b>${amount} ${currency}</b>
📱 المحول منه: <b>${senderNameOrPhone.trim()}</b>
🔖 الرقم المرجعي: <code>${referenceCode.trim() || 'لا يوجد'}</code>
⏰ التاريخ: ${new Date().toLocaleString('ar-EG')}
⚠️ <b>الحالة: بانتظار مراجعة الإيصال والتفعيل اليدوي عبر الدعم الفني</b>
`;
        sendTelegramMessage('admin', adminTelegramMsg, 'HTML').catch(() => {});
      } catch (tgErr) {
        console.warn('Telegram notification warning:', tgErr);
      }

      setIsSuccess(true);
      onSuccess?.();
    } catch (err: any) {
      console.error('Error confirming InstaPay transfer:', err);
      setErrorMsg(err?.message || 'حدث خطأ أثناء تسجيل الطلب، يرجى المحاولة مجدداً');
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * فتح واتساب مع رسالة مجهزة تتضمن تفاصيل التحويل لإرسال الإيصال
   */
  const handleOpenWhatsApp = () => {
    const studentName = currentUser?.fullName || senderNameOrPhone || 'طالب طرقع';
    const studentEmail = currentUser?.email || 'حساب منصة طرقع';
    const text = encodeURIComponent(
      `السلام عليكم، قمت بتحويل مبلغ الاشتراك (${amount} ${currency}) عبر تطبيق إنستاباي لحساب yoska1@instapay (${receiverName}) لمنصة طرقع.\n` +
      `👤 اسم الطالب: ${studentName}\n` +
      `📧 البريد: ${studentEmail}\n` +
      `📱 المحول منه: ${senderNameOrPhone || 'مرفق الإيصال'}\n` +
      `🔖 الرقم المرجعي: ${referenceCode || 'مرفق'}\n` +
      `أرجو مراجعة الإيصال وتفعيل الاشتراك في حسابي.`
    );
    window.open(`${SUPPORT_WHATSAPP_URL}?text=${text}`, '_blank');
  };

  return (
    <div
      dir="rtl"
      className={`relative w-full max-w-xl mx-auto rounded-3xl bg-[#0b0f19] text-white p-5 sm:p-7 border border-fuchsia-500/25 shadow-[0_0_50px_rgba(217,70,239,0.08)] overflow-hidden ${className}`}
    >
      {/* إضاءة خلفية بلون إنستاباي المميز الفوشيا والبنفسجي */}
      <div className="absolute -top-24 -right-24 w-60 h-60 bg-fuchsia-600/15 rounded-full blur-[80px] pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-60 h-60 bg-purple-600/15 rounded-full blur-[80px] pointer-events-none" />
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-fuchsia-500 to-transparent opacity-80" />

      {/* الرأس */}
      <div className="relative z-10 mb-4 pb-4 border-b border-slate-800/80">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-fuchsia-600/20 to-purple-600/20 border border-fuchsia-500/30 flex items-center justify-center text-fuchsia-400 shadow-[0_0_20px_rgba(217,70,239,0.25)]">
              <Zap className="w-5 h-5 fill-current" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-100 flex items-center gap-2">
                <span>التحويل المباشر عبر إنستاباي</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-fuchsia-500/15 text-fuchsia-300 border border-fuchsia-500/30 font-bold flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5" />
                  <span>InstaPay Egypt</span>
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                تحويل مباشر من أي بنك أو محفظة إلكترونية بمصر
              </p>
            </div>
          </div>

          <div className="text-left">
            <div className="text-[10px] text-slate-400 font-bold">المبلغ المطلوب:</div>
            <div className="text-lg font-black text-amber-400 font-mono">
              {amount} <span className="text-xs font-bold text-slate-300">جنيه</span>
            </div>
          </div>
        </div>
      </div>

      {/* ⚠️ تنبيه صريح: عدم التفعيل التلقائي إلا بالتواصل مع الدعم الفني عبر واتساب */}
      <div className="relative z-10 mb-4 p-3.5 sm:p-4 rounded-2xl bg-amber-500/10 border border-amber-500/35 text-amber-200 text-xs flex items-start gap-3 shadow-inner">
        <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1 text-right">
          <span className="font-black text-amber-300 block text-xs sm:text-sm">
            تنويه هام بشأن تفعيل اشتراكات إنستاباي:
          </span>
          <p className="text-[11px] sm:text-xs text-slate-300 leading-relaxed">
            اشتراكات إنستاباي <strong>لا يتم تفعيلها تلقائياً</strong>؛ بل يتم مراجعتها وتفعيل الدورة يدوياً من قِبل الدعم الفني فور إرسال صورة إيصال التحويل عبر واتساب على الرقم (<strong>{instapayPhone}</strong>).
          </p>
        </div>
      </div>

      {/* بطاقة بيانات الحساب للتحويل */}
      <div className="relative z-10 mb-4 p-4 rounded-2xl bg-gradient-to-br from-[#121626] to-[#0d1220] border border-fuchsia-500/20 space-y-3">
        <div className="text-xs font-bold text-fuchsia-300 flex items-center gap-1.5">
          <Smartphone className="w-4 h-4" />
          <span>بيانات تحويل إنستاباي الرسمية:</span>
        </div>

        {/* 1. عنوان إنستاباي (IPA) */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/80 border border-slate-800">
          <div>
            <div className="text-[10px] text-slate-400 font-bold">عنوان الدفع بالانستاباي (IPA):</div>
            <div className="text-sm sm:text-base font-black text-amber-300 font-mono select-all">
              {instapayIPA}
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleCopy(instapayIPA, 'ipa')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              copiedIPA
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-fuchsia-500/15 hover:bg-fuchsia-500/25 text-fuchsia-300 border border-fuchsia-500/30'
            }`}
          >
            {copiedIPA ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>تم النسخ ✓</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>نسخ الحساب</span>
              </>
            )}
          </button>
        </div>

        {/* 2. رقم الهاتف المسجل */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/80 border border-slate-800">
          <div>
            <div className="text-[10px] text-slate-400 font-bold">أو التحويل على رقم الهاتف:</div>
            <div className="text-sm font-black text-slate-100 font-mono select-all" dir="ltr">
              {instapayPhone}
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleCopy(instapayPhone, 'phone')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              copiedPhone
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30'
            }`}
          >
            {copiedPhone ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>تم النسخ ✓</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>نسخ الرقم</span>
              </>
            )}
          </button>
        </div>

        {/* اسم المستلم / الحساب المرفق */}
        <div className="flex items-center justify-between text-xs pt-1 px-1 text-slate-400">
          <span>اسم المستلم / الحساب المرفق في إنستاباي:</span>
          <span className="font-mono font-black text-amber-300 tracking-wider text-sm">{receiverName}</span>
        </div>
      </div>

      {/* زر فتح تطبيق إنستاباي مباشرة على الهاتف */}
      <div className="relative z-10 mb-4">
        <a
          href="instapay://"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full py-2.5 px-4 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 transition flex items-center justify-center gap-2 text-xs font-bold"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span>فتح تطبيق InstaPay على هاتفك (إن وُجد)</span>
        </a>
      </div>

      {/* نموذج تسجيل التحويل */}
      {!isSuccess ? (
        <div className="relative z-10 mb-4 space-y-3 p-4 rounded-2xl bg-[#0e1424]/90 border border-slate-800">
          <div className="text-xs font-black text-slate-200 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>تسجيل بيانات التحويل:</span>
          </div>

          {/* حقل اسم أو هاتف المحول */}
          <div>
            <label className="block text-[11px] font-bold text-slate-300 mb-1">
              اسم صاحب الحساب أو رقم الهاتف المحول منه <span className="text-rose-400">*</span>:
            </label>
            <input
              type="text"
              value={senderNameOrPhone}
              onChange={(e) => setSenderNameOrPhone(e.target.value)}
              placeholder="مثال: أحمد محمد أو 01012345678"
              className="w-full py-2.5 px-3.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-fuchsia-500 transition"
            />
          </div>

          {/* حقل الرقم المرجعي */}
          <div>
            <label className="block text-[11px] font-bold text-slate-300 mb-1">
              الرقم المرجعي للتحويل / كود العملية (اختياري):
            </label>
            <input
              type="text"
              value={referenceCode}
              onChange={(e) => setReferenceCode(e.target.value)}
              placeholder="مثال: Ref #12345678"
              className="w-full py-2.5 px-3.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-fuchsia-500 transition font-mono"
            />
          </div>

          {/* رفع صورة الإيصال */}
          <div>
            <label className="block text-[11px] font-bold text-slate-300 mb-1">
              إرفاق لقطة شاشة للإيصال (Screenshot):
            </label>
            <label className="relative w-full py-3 px-4 rounded-xl border border-dashed border-slate-700 hover:border-fuchsia-500/60 bg-slate-950/60 transition cursor-pointer flex items-center justify-between gap-3 text-xs">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="flex items-center gap-2 text-slate-300">
                <UploadCloud className="w-4 h-4 text-fuchsia-400" />
                <span className="line-clamp-1">
                  {receiptFileName || 'اضغط هنا لرفع صورة إيصال التحويل'}
                </span>
              </div>
              {receiptImage ? (
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                  تم إرفاق الصورة ✓
                </span>
              ) : (
                <span className="text-[10px] text-slate-500">JPG, PNG</span>
              )}
            </label>

            {receiptImage && (
              <div className="mt-2 relative w-full h-24 rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
                <img
                  src={receiptImage}
                  alt="إيصال إنستاباي"
                  className="w-full h-full object-contain"
                />
                <button
                  type="button"
                  onClick={() => {
                    setReceiptImage(null);
                    setReceiptFileName('');
                  }}
                  className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded bg-rose-600/80 text-white text-[10px] font-bold hover:bg-rose-600 transition cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* رسالة الخطأ إن وُجدت */}
      {errorMsg && (
        <div className="relative z-10 mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="font-bold">{errorMsg}</span>
        </div>
      )}

      {/* رسالة نجاح التسجيل وتوجيه الطالب للتواصل مع الدعم الفني لتفعيل الحساب */}
      {isSuccess && (
        <div className="relative z-10 mb-5 p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/35 text-slate-100 text-xs space-y-3 animate-in fade-in">
          <div className="flex items-center gap-2 text-emerald-400 font-black text-sm">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span>تم تسجيل بيانات التحويل بنجاح! ⏳</span>
          </div>
          <p className="text-[11px] sm:text-xs text-slate-300 leading-relaxed">
            <strong>الخطوة الأخيرة لتفعيل حسابك:</strong> اضغط على الزر أدناه لإرسال لقطة شاشة لإيصال التحويل إلى الدعم الفني عبر واتساب وسيقوم بتفعيل اشتراكك السنوي فوراً.
          </p>
          <button
            type="button"
            onClick={handleOpenWhatsApp}
            className="w-full py-3.5 px-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs sm:text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/30 cursor-pointer active:scale-98"
          >
            <MessageCircle className="w-4 h-4 fill-current" />
            <span>إرسال الإيصال عبر واتساب لتفعيل الاشتراك الآن (01104687320)</span>
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2 px-4 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-bold transition cursor-pointer"
            >
              إغلاق النافذة
            </button>
          )}
        </div>
      )}

      {/* أزرار الإجراءات */}
      {!isSuccess ? (
        <div className="relative z-10 space-y-2.5">
          <button
            type="button"
            onClick={handleConfirmTransfer}
            disabled={isSubmitting}
            className="w-full py-3.5 px-6 rounded-2xl font-black text-sm text-slate-950 bg-gradient-to-r from-fuchsia-400 via-pink-400 to-fuchsia-500 hover:from-fuchsia-300 hover:to-fuchsia-400 shadow-[0_0_25px_rgba(217,70,239,0.35)] flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-98 disabled:opacity-50 select-none"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                <span>جاري تسجيل الطلب وإشعار الإدارة...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-slate-950" />
                <span>تسجيل التحويل ومتابعة التفعيل عبر الدعم الفني</span>
              </>
            )}
          </button>

          {/* زر التواصل المباشر عبر واتساب */}
          <button
            type="button"
            onClick={handleOpenWhatsApp}
            className="w-full py-2.5 px-4 rounded-xl bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-300 hover:text-emerald-200 border border-emerald-500/30 transition flex items-center justify-center gap-2 text-xs font-bold cursor-pointer"
          >
            <MessageCircle className="w-4 h-4 text-emerald-400" />
            <span>التواصل وإرسال الإيصال عبر واتساب الدعم ({instapayPhone})</span>
          </button>
        </div>
      ) : null}

      {/* تذييل الأمان */}
      <p className="relative z-10 mt-4 text-[10px] text-center text-slate-400 flex items-center justify-center gap-1.5">
        <Lock className="w-3 h-3 text-slate-500" />
        <span>يتم تفعيل الاشتراك يدوياً بواسطة الدعم الفني فور استلام صورة الإيصال عبر واتساب</span>
      </p>
    </div>
  );
};

export default InstaPayCheckout;
