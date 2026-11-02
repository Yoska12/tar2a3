import { TarqaUser } from './supabase';

export interface StudentDisplayIdentity {
  name: string;
  identifier: string;
  shortId: string;
  fullId: string;
}

/**
 * دالة موحدة لاستخراج وعرض بيانات وهوية الطالب للعلامات المائية والأمان
 */
export const getStudentDisplayIdentity = (
  user?: TarqaUser | any | null
): StudentDisplayIdentity => {
  const name =
    user?.fullName?.trim() ||
    user?.full_name?.trim() ||
    user?.name?.trim() ||
    user?.email?.split('@')[0] ||
    'طالب منصة طرقع';

  const identifier =
    user?.phone ||
    user?.phoneNumber ||
    user?.phone_number ||
    user?.email ||
    user?.telegramUsername ||
    user?.telegram_username ||
    (user?.id ? `ID-#${user.id.slice(0, 10)}` : 'حساب مسجل');

  const shortId = user?.id ? `#${user.id.slice(0, 8)}` : 'TRQ-STUDENT';
  const fullId = user?.id || 'guest-student';

  return {
    name,
    identifier,
    shortId,
    fullId,
  };
};
