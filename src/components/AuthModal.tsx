import React from 'react';
import { TarqaUser } from '../lib/supabase';
import { InteractiveLoginPage } from './InteractiveLoginPage';

export interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUserLoggedIn?: (user: TarqaUser) => void;
  initialTab?: 'signin' | 'signup';
  onOpenPolicies?: (tab: 'terms' | 'privacy' | 'cookies' | 'refund') => void;
  isStandalonePage?: boolean;
}

/**
 * صفحة / نافذة تسجيل الدخول التفاعلية لمنصة طرقع
 * تتميز بشبكة 2x2 من حروف كلمة طرقع مع عيون تتتبع حركة الماوس بدقة،
 * واهتزاز سريع عند كلمة المرور الخاطئة، واحتفال حماسي ومفرقعات عند النجاح.
 */
export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onUserLoggedIn,
  initialTab = 'signin',
  onOpenPolicies,
  isStandalonePage = false,
}) => {
  if (!isOpen && !isStandalonePage) return null;

  return (
    <InteractiveLoginPage
      isOpen={isOpen}
      onClose={onClose}
      onSuccess={onUserLoggedIn}
      initialTab={initialTab}
      onOpenPolicies={onOpenPolicies}
      isStandalonePage={isStandalonePage}
    />
  );
};

export { InteractiveLoginPage };
export default AuthModal;
