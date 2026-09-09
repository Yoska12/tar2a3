import { supabase } from '@/lib/supabase';
import { UserRole } from '@/types';

// 1. GET: جلب قائمة المستخدمين وإحصائيات الرتب وسجل التدقيق
export async function GET(request: Request) {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: 'يجب تسجيل الدخول أولاً' }, { status: 401 });
    }

    const isYassien = user?.email?.trim().toLowerCase() === 'yassooooo27m@gmail.com';
    const rawRole = (user?.app_metadata?.role as UserRole) || (request.headers.get('x-user-role') as UserRole);
    const userRole = isYassien ? 'admin' : (rawRole === 'super_admin' ? 'admin' : rawRole);

    // التحقق من الصلاحية: مسؤولو المنصة (Admins)
    if (userRole !== 'admin') {
      return Response.json(
        { error: 'غير مصرح: الوصول لبيانات الرتب محصور بمسؤولي المنصة (Admins) فقط.' },
        { status: 403 }
      );
    }

    // جلب المستخدمين من جدول profiles
    const { data: rawProfiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, target_score, telegram_username, telegram_id, avatar_url, created_at, last_sign_in_at')
      .order('created_at', { ascending: false });

    if (profilesError) {
      return Response.json({ error: profilesError.message }, { status: 500 });
    }

    // تسوية أي رتبة سوبر أدمن سابقة إلى مسؤول المنصة
    const profiles = (rawProfiles || []).map((p) => ({
      ...p,
      role: (p.role === 'super_admin' || p.email?.trim().toLowerCase() === 'yassooooo27m@gmail.com')
        ? ('admin' as UserRole)
        : (p.role as UserRole),
    }));

    // جلب سجل التدقيق
    const { data: rawLogs, error: logsError } = await supabase
      .from('role_change_logs')
      .select('id, admin_id, target_user_id, old_role, new_role, reason, created_at')
      .order('created_at', { ascending: false })
      .limit(50);

    const logs = (rawLogs || []).map((l) => ({
      ...l,
      old_role: l.old_role === 'super_admin' ? 'admin' : l.old_role,
      new_role: l.new_role === 'super_admin' ? 'admin' : l.new_role,
    }));

    const stats = {
      total: profiles.length,
      superAdmin: 0,
      admin: profiles.filter((p) => p.role === 'admin').length,
      teacher: profiles.filter((p) => p.role === 'teacher').length,
      student: profiles.filter((p) => p.role === 'student').length,
    };

    return Response.json({
      users: profiles,
      stats,
      logs,
    });
  } catch (error: any) {
    return Response.json({ error: error.message || 'خطأ في الخادم' }, { status: 500 });
  }
}

// 2. PATCH / POST: تعديل رتبة مستخدم وتسجيل العملية في سجل التدقيق
export async function PATCH(request: Request) {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: 'يجب تسجيل الدخول أولاً' }, { status: 401 });
    }

    const isYassien = user?.email?.trim().toLowerCase() === 'yassooooo27m@gmail.com';
    const rawRole = (user?.app_metadata?.role as UserRole) || (request.headers.get('x-user-role') as UserRole);
    const userRole = isYassien ? 'admin' : (rawRole === 'super_admin' ? 'admin' : rawRole);

    // التحقق من رتبة المسؤول
    if (userRole !== 'admin') {
      return Response.json(
        { error: 'عملية غير مصرح بها: ترقية وسحب الرتب محصورة بمسؤولي المنصة (Admins) حصراً.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { targetUserId, newRole, reason } = body;

    if (!targetUserId || !newRole) {
      return Response.json(
        { error: 'البيانات غير مكتملة: targetUserId و newRole مطلوبان.' },
        { status: 400 }
      );
    }

    // منع تعيين رتبة سوبر أدمن
    if (newRole === 'super_admin') {
      return Response.json(
        { error: 'تم إلغاء رتبة السوبر أدمن من المنصة. أعلى رتبة إدارية هي مسؤول المنصة (Admin).' },
        { status: 400 }
      );
    }

    const validRoles: UserRole[] = ['student', 'teacher', 'admin'];
    if (!validRoles.includes(newRole)) {
      return Response.json({ error: 'الرتبة المحددة غير صالحة.' }, { status: 400 });
    }

    // التحقق من المستخدم المستهدف
    const { data: targetProfile, error: fetchError } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .eq('id', targetUserId)
      .single();

    if (fetchError || !targetProfile) {
      return Response.json({ error: 'لم يتم العثور على المستخدم المستهدف.' }, { status: 404 });
    }

    // تحديث رتبة المستخدم في profiles
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', targetUserId);

    if (updateError) {
      return Response.json({ error: updateError.message }, { status: 500 });
    }

    // تسجيل العملية في جدول التدقيق role_change_logs
    await supabase.from('role_change_logs').insert({
      admin_id: user?.id || targetUserId,
      target_user_id: targetUserId,
      old_role: targetProfile.role === 'super_admin' ? 'admin' : targetProfile.role,
      new_role: newRole,
      reason: reason || 'تعديل عبر واجهة إدارة الرتب',
    });

    return Response.json({
      success: true,
      message: `تم تحديث رتبة ${targetProfile.full_name || 'المستخدم'} بنجاح إلى ${newRole}`,
      updatedRole: newRole,
    });
  } catch (error: any) {
    return Response.json({ error: error.message || 'فشل في تحديث الرتبة' }, { status: 500 });
  }
}
