import { supabase } from '@/lib/supabase';
import { UserRole, UserWithRole, RoleChangeLog } from '@/types';

/**
 * دالة لتحديث رتبة مستخدم بواسطة مسؤول المنصة حصراً
 */
export async function updateUserRoleAction(
  targetUserId: string,
  newRole: UserRole,
  reason?: string
): Promise<{ success: boolean; error?: string; message?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'يجب تسجيل الدخول أولاً' };
    }

    const userEmailLower = user.email?.trim().toLowerCase();
    const isOwner = userEmailLower === 'yassooooo27m@gmail.com' || userEmailLower === 'iyoskalg@gmail.com';
    const rawRole = (user.app_metadata?.role as UserRole) || (user.user_metadata?.role as UserRole);
    const callerRole: UserRole = isOwner ? 'super_admin' : (rawRole || 'student');

    if (callerRole !== 'admin' && callerRole !== 'super_admin') {
      return {
        success: false,
        error: 'عملية غير مصرح بها: ترقية وسحب الرتب محصورة بمسؤولي وسوبر أدمن المنصة حصراً.',
      };
    }

    // جلب المستخدم المستهدف
    const { data: targetProfile, error: fetchErr } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .eq('id', targetUserId)
      .single();

    if (fetchErr || !targetProfile) {
      return { success: false, error: 'لم يتم العثور على المستخدم' };
    }

    // منح رتبة السوبر أدمن محصور بمالك المنصة أو سوبر أدمن
    if (newRole === 'super_admin' && !isOwner && callerRole !== 'super_admin') {
      return {
        success: false,
        error: 'منح رتبة السوبر أدمن محصور بمالك المنصة والسوبر أدمن حصراً.',
      };
    }

    // التحديث في profiles
    const { error: updateErr } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', targetUserId);

    if (updateErr) {
      return { success: false, error: updateErr.message };
    }

    // تسجيل العملية في role_change_logs
    await supabase.from('role_change_logs').insert({
      admin_id: user.id,
      target_user_id: targetUserId,
      old_role: targetProfile.role,
      new_role: newRole,
      reason: reason || 'تعديل عبر Server Action',
    });

    return {
      success: true,
      message: `تم تحديث رتبة ${targetProfile.full_name || 'المستخدم'} إلى ${newRole} بنجاح`,
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'فشل في تنفيذ العملية' };
  }
}
