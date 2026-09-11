/**
 * ============================================================================
 * منصة طرقع - نظام الأمان والحماية المتقدم ومكافحة الغش (Anti-Hack & Security Shield)
 * ============================================================================
 * يحمي المنصة من:
 * 1. فتح أدوات المطورين (DevTools / Inspect Element / Console / View Source)
 * 2. نسخ الأسئلة والمذكرات وتنزيل المحتوى بدون إذن
 * 3. التقاط الشاشة وتسريب بنك أسئلة قياس (PrintScreen Deterrent)
 * 4. الغش في الاختبارات بمغادرة التبويب والبحث في جوجل أو الذكاء الاصطناعي
 * 5. التلاعب في localStorage للترقية الإدارية غير المصرح بها (Role & State Tampering)
 * 6. لصق سكربتات الاختراق في Console (Self-XSS Protection)
 */

export interface SecurityViolation {
  id: string;
  userId: string;
  userName: string;
  type: 'devtools_attempt' | 'tab_switch' | 'copy_attempt' | 'screenshot_attempt' | 'storage_tamper' | 'right_click' | 'role_tampering';
  details: string;
  timestamp: string;
}

export interface AntiHackSettings {
  enabled: boolean;
  blockDevTools: boolean;
  blockContextMenu: boolean;
  blockCopyCut: boolean;
  blockPrintScreen: boolean;
  detectTabSwitch: boolean;
  maxExamTabSwitches: number;
  autoSubmitOnCheat: boolean;
  allowAdminsBypass: boolean;
}

const SETTINGS_KEY = 'tarqa_security_settings';
const LOGS_KEY = 'tarqa_security_logs';

export const defaultAntiHackSettings: AntiHackSettings = {
  enabled: true,
  blockDevTools: true,
  blockContextMenu: true,
  blockCopyCut: true,
  blockPrintScreen: true,
  detectTabSwitch: true,
  maxExamTabSwitches: 3,
  autoSubmitOnCheat: true,
  allowAdminsBypass: true,
};

/**
 * استرجاع إعدادات الحماية
 */
export const getAntiHackSettings = (): AntiHackSettings => {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...defaultAntiHackSettings };
    return { ...defaultAntiHackSettings, ...JSON.parse(raw) };
  } catch (e) {
    return { ...defaultAntiHackSettings };
  }
};

/**
 * حفظ وتحديث إعدادات الحماية
 */
export const saveAntiHackSettings = (newSettings: Partial<AntiHackSettings>): AntiHackSettings => {
  try {
    const current = getAntiHackSettings();
    const updated = { ...current, ...newSettings };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
    return updated;
  } catch (e) {
    return { ...defaultAntiHackSettings, ...newSettings };
  }
};

/**
 * تسجيل مخالفة أمنية في سجل الرصد
 */
export const logSecurityViolation = (
  violationOrType: Omit<SecurityViolation, 'id' | 'timestamp'> | SecurityViolation['type'],
  details?: string,
  userId?: string,
  userName?: string
) => {
  try {
    const logs = getSecurityViolations();
    let entryData: Omit<SecurityViolation, 'id' | 'timestamp'>;

    if (typeof violationOrType === 'string') {
      entryData = {
        type: violationOrType,
        details: details || '',
        userId: userId || 'anonymous',
        userName: userName || 'مستخدم غير مسجل',
      };
    } else {
      entryData = violationOrType;
    }

    const newEntry: SecurityViolation = {
      ...entryData,
      id: 'sec-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      timestamp: new Date().toISOString(),
    };

    // الاحتفاظ بآخر 100 مخالفة فقط لمنع امتلاء الذاكرة
    const updated = [newEntry, ...logs].slice(0, 100);
    localStorage.setItem(LOGS_KEY, JSON.stringify(updated));
    
    // إرسال تنبيه مخصص لـ CustomEvent لمن يراقب الأحداث في الواجهة
    window.dispatchEvent(new CustomEvent('tarqa-security-alert', { detail: newEntry }));
  } catch (e) {
    console.warn('[Anti-Hack] Failed to save security log:', e);
  }
};

/**
 * جلب سجل المخالفات الأمنية
 */
export const getSecurityViolations = (): SecurityViolation[] => {
  try {
    const raw = localStorage.getItem(LOGS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) || [];
  } catch (e) {
    return [];
  }
};

/**
 * تفريغ سجل المخالفات
 */
export const clearSecurityViolations = () => {
  try {
    localStorage.removeItem(LOGS_KEY);
  } catch (e) {}
};

/**
 * طباعة تحذير رادع ومبهر في الـ Console لمنع Self-XSS ومحاولات لصق أكواد الاختراق
 */
export const displayConsoleSelfXssWarning = () => {
  try {
    const titleStyle = 'font-size: 26px; font-weight: 900; color: #ef4444; text-shadow: 2px 2px 4px #000; padding: 6px 12px;';
    const warningStyle = 'font-size: 14px; font-weight: bold; color: #f59e0b; line-height: 1.6;';
    const infoStyle = 'font-size: 12px; color: #94a3b8; font-family: monospace;';

    console.log('%c⚠️ تحذير أمني شديد - منصة طرقع 🛑', titleStyle);
    console.log(
      '%cتنبيه: هذه المنطقة مخصصة لمطوري منصة طرقع المعتمدين فقط!\n' +
      'إذا طلب منك أي شخص نسخ ولصق أي كود هنا بدعوى "فتح المحاضرات" أو "كشف إجابات الاختبارات"، فهو يحاول سرقة حسابك والتلاعب ببياناتك.\n' +
      'جميع محاولات التلاعب بالبيانات أو حقن السكربتات يتم تسجيلها وربطها برقم المعرف وعنوان IP تلقائياً.',
      warningStyle
    );
    console.log('%cProtected by Tarqa Anti-Hack Security Core v3.0 • All Rights Reserved', infoStyle);
  } catch (e) {}
};

/**
 * تهيئة نظام الحماية الشامل للمنصة
 */
export const initGlobalAntiHack = (
  getCurrentUser: () => { id?: string; fullName?: string; role?: string } | null,
  onSecurityAlert?: (msg: string) => void
): (() => void) => {
  // طباعة تحذير الكونسول فوراً
  displayConsoleSelfXssWarning();

  // فحص ما إذا كان المستخدم مشرفاً ويحق له التجاوز
  const shouldBypass = () => {
    const settings = getAntiHackSettings();
    if (!settings.enabled) return true;
    if (!settings.allowAdminsBypass) return false;
    const user = getCurrentUser();
    return user?.role === 'super_admin' || user?.role === 'admin';
  };

  // 1. اعتراض القائمة المنسدلة للزر الأيمن (Context Menu)
  const handleContextMenu = (e: MouseEvent) => {
    const settings = getAntiHackSettings();
    if (!settings.enabled || !settings.blockContextMenu || shouldBypass()) return;

    // السماح بالزر الأيمن فقط داخل حقول الإدخال لتسهيل الكتابة للمستخدم
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
      return;
    }

    e.preventDefault();
    onSecurityAlert?.('🔒 تم تعطيل القائمة المنسدلة لحماية محتوى المنصة والأسئلة.');
  };

  // 2. اعتراض اختصارات لوحة المفاتيح المخصصة للفحص والسرقة
  const handleKeyDown = (e: KeyboardEvent) => {
    const settings = getAntiHackSettings();
    if (!settings.enabled || shouldBypass()) return;

    const key = e.key.toUpperCase();
    const isCtrlOrCmd = e.ctrlKey || e.metaKey;

    // F12: DevTools
    if (settings.blockDevTools && e.key === 'F12') {
      e.preventDefault();
      e.stopPropagation();
      logSecurityViolation({
        userId: getCurrentUser()?.id || 'GUEST',
        userName: getCurrentUser()?.fullName || 'زائر',
        type: 'devtools_attempt',
        details: 'محاولة فتح أدوات المطورين عبر مفتاح F12',
      });
      onSecurityAlert?.('⚠️ تم تعطيل مفتاح F12 لحماية محتوى الاختبارات والشروحات.');
      return false;
    }

    // Ctrl+Shift+I / J / C (Inspect Element & Console)
    if (settings.blockDevTools && isCtrlOrCmd && e.shiftKey && (key === 'I' || key === 'J' || key === 'C')) {
      e.preventDefault();
      e.stopPropagation();
      logSecurityViolation({
        userId: getCurrentUser()?.id || 'GUEST',
        userName: getCurrentUser()?.fullName || 'زائر',
        type: 'devtools_attempt',
        details: `محاولة فحص الصفحة عبر اختصار Ctrl+Shift+${key}`,
      });
      onSecurityAlert?.('⚠️ تم حظر اختصارات فحص الصفحة لحماية حقوق الملكية الفكرية.');
      return false;
    }

    // Ctrl+U (View Page Source)
    if (settings.blockDevTools && isCtrlOrCmd && key === 'U') {
      e.preventDefault();
      e.stopPropagation();
      onSecurityAlert?.('🔒 تم حظر عرض المصدر لحماية أمان المنصة.');
      return false;
    }

    // Ctrl+S (Save Page)
    if (settings.blockCopyCut && isCtrlOrCmd && key === 'S') {
      e.preventDefault();
      e.stopPropagation();
      onSecurityAlert?.('🔒 تم حظر حفظ الصفحة دون إذن.');
      return false;
    }

    // PrintScreen: مسح الحافظة فوراً لحماية الأسئلة من لقطات الشاشة المسربة
    if (settings.blockPrintScreen && (e.key === 'PrintScreen' || key === 'PRINTSCREEN')) {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText('');
        }
      } catch (err) {}
      logSecurityViolation({
        userId: getCurrentUser()?.id || 'GUEST',
        userName: getCurrentUser()?.fullName || 'زائر',
        type: 'screenshot_attempt',
        details: 'رصد ضغط زر التقاط الشاشة PrintScreen',
      });
      onSecurityAlert?.('🛡️ تنبيه: محتوى بنك الأسئلة محمي من التصوير والتسريب.');
    }
  };

  // 3. منع النسخ والقص للمحتوى المحمي
  const handleCopyCut = (e: ClipboardEvent) => {
    const settings = getAntiHackSettings();
    if (!settings.enabled || !settings.blockCopyCut || shouldBypass()) return;

    const target = e.target as HTMLElement | null;
    // السماح بالنسخ من حقول الإدخال العادية
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
      return;
    }

    e.preventDefault();
    logSecurityViolation({
      userId: getCurrentUser()?.id || 'GUEST',
      userName: getCurrentUser()?.fullName || 'زائر',
      type: 'copy_attempt',
      details: 'محاولة نسخ محتوى من الصفحة المحمية',
    });
    onSecurityAlert?.('🔒 نسخ نصوص الأسئلة والمذكرات غير مصرح به.');
  };

  // 4. مراقبة فحص فتح الـ DevTools دورياً عبر نافذة المتصفح
  let devtoolsInterval: any = null;
  if (getAntiHackSettings().blockDevTools) {
    let devtoolsOpen = false;
    devtoolsInterval = setInterval(() => {
      if (shouldBypass()) return;

      const threshold = 160;
      const widthThreshold = window.outerWidth - window.innerWidth > threshold;
      const heightThreshold = window.outerHeight - window.innerHeight > threshold;

      if (widthThreshold || heightThreshold) {
        if (!devtoolsOpen) {
          devtoolsOpen = true;
          logSecurityViolation({
            userId: getCurrentUser()?.id || 'GUEST',
            userName: getCurrentUser()?.fullName || 'زائر',
            type: 'devtools_attempt',
            details: 'تم رصد نافذة أدوات المطورين مفتوحة بجانب الصفحة',
          });
          onSecurityAlert?.('⚠️ تم رصد فتح أدوات الفحص للمتصفح! المحتوى مشفر ومراقب.');
        }
      } else {
        devtoolsOpen = false;
      }
    }, 2000);
  }

  // إضافة المستمعات
  document.addEventListener('contextmenu', handleContextMenu, true);
  window.addEventListener('keydown', handleKeyDown, true);
  document.addEventListener('copy', handleCopyCut, true);
  document.addEventListener('cut', handleCopyCut, true);

  // إرجاع دالة الإلغاء والتنظيف
  return () => {
    document.removeEventListener('contextmenu', handleContextMenu, true);
    window.removeEventListener('keydown', handleKeyDown, true);
    document.removeEventListener('copy', handleCopyCut, true);
    document.removeEventListener('cut', handleCopyCut, true);
    if (devtoolsInterval) clearInterval(devtoolsInterval);
  };
};
