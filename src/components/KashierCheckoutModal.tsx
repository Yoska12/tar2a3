import React, { useState } from 'react';
import { X, ShieldCheck, CreditCard, Zap, Sparkles } from 'lucide-react';
import { TarqaUser } from '../lib/supabase';
import { KashierTransaction } from '../lib/kashierService';
import { KashierCheckout } from './KashierCheckout';
import { InstaPayCheckout } from './InstaPayCheckout';

export interface KashierCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: TarqaUser | null;
  onPaymentSuccess: (transaction: KashierTransaction) => void;
  customAmount?: number;
  customCurrency?: 'EGP' | 'SAR';
  onOpenPolicies?: (tab: 'terms' | 'privacy' | 'cookies' | 'refund') => void;
}

export const KashierCheckoutModal: React.FC<KashierCheckoutModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onPaymentSuccess,
  customAmount = 1100,
  customCurrency = 'EGP',
  onOpenPolicies,
}) => {
  // التبويب النشط بين كاشير وإنستاباي
  const [activePaymentMethod, setActivePaymentMethod] = useState<'kashier' | 'instapay'>('kashier');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-md animate-in fade-in overflow-y-auto">
      <div className="relative w-full max-w-xl my-auto">
        {/* شريط رأس النافذة */}
        <div className="flex justify-between items-center mb-2 px-1">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>بوابة الاشتراك والدفع المعتمدة • تشفير 256-bit</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition cursor-pointer flex items-center gap-1.5 text-xs font-bold"
            aria-label="إغلاق النافذة"
          >
            <X className="w-4 h-4" />
            <span>إغلاق</span>
          </button>
        </div>

        {/* أزرار التبديل الفخمة بين طرق الدفع: كاشير أو إنستاباي */}
        <div className="flex items-center gap-2 mb-3 bg-[#0d1322] p-1.5 rounded-2xl border border-slate-800">
          <button
            type="button"
            onClick={() => setActivePaymentMethod('kashier')}
            className={`flex-1 py-2.5 px-3 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition cursor-pointer ${
              activePaymentMethod === 'kashier'
                ? 'bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>بوابة كاشير (كروت ومحافظ)</span>
          </button>

          <button
            type="button"
            onClick={() => setActivePaymentMethod('instapay')}
            className={`flex-1 py-2.5 px-3 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition cursor-pointer ${
              activePaymentMethod === 'instapay'
                ? 'bg-gradient-to-r from-fuchsia-500 via-pink-500 to-purple-600 text-white shadow-md shadow-fuchsia-500/25'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Zap className="w-4 h-4 fill-current" />
            <span>تحويل إنستاباي (InstaPay ⚡)</span>
          </button>
        </div>

        {/* محتوى الدفع حسب الطريقة المختارة */}
        {activePaymentMethod === 'kashier' ? (
          <KashierCheckout
            currentUser={currentUser}
            defaultCurrency={customCurrency}
            onSuccess={(tx) => {
              onPaymentSuccess(tx);
              onClose();
            }}
            onError={(err) => {
              console.error('[Kashier Modal] Payment error:', err);
            }}
            showTitle={true}
          />
        ) : (
          <InstaPayCheckout
            currentUser={currentUser}
            amount={customAmount || 1100}
            currency="EGP"
            onSuccess={() => {
              // لا يتم تفعيل الاشتراك تلقائياً لاشتراكات إنستاباي؛ التفعيل يتم يدوياً عبر الدعم الفني بعد التحقق من الإيصال
            }}
            onClose={onClose}
          />
        )}

        {/* روابط السياسات في أسفل النافذة */}
        {onOpenPolicies && (
          <div className="mt-3 text-center text-xs text-slate-400 flex items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => onOpenPolicies('terms')}
              className="hover:text-amber-400 transition cursor-pointer"
            >
              الشروط والأحكام
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={() => onOpenPolicies('privacy')}
              className="hover:text-amber-400 transition cursor-pointer"
            >
              سياسة الخصوصية
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={() => onOpenPolicies('refund')}
              className="hover:text-amber-400 transition cursor-pointer"
            >
              سياسة الاسترجاع
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default KashierCheckoutModal;
