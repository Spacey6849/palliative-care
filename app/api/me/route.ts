import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase/client';

export async function GET() {
  const cookieStore = cookies();
  const token = cookieStore.get('bl_session')?.value || cookieStore.get('ecw_session')?.value || cookieStore.get('ecw_admin_session')?.value;
  if (!token) return NextResponse.json({ user: null });
  const supabase = getSupabase();
  // Try user session
  const { data: sess, error: sessErr } = await supabase
    .from('sessions')
    .select('user_id, expires_at')
    .eq('token', token)
    .limit(1)
    .maybeSingle();
  if (sessErr) return NextResponse.json({ user: null });
  if (sess) {
    if (new Date((sess as any).expires_at) <= new Date()) return NextResponse.json({ user: null });
    const userId = (sess as any).user_id as string;
    // Try normal user first
  const { data: user } = await supabase
    .from('users')
    .select('id,email,username,full_name,phone,location,bin_category,created_at')
    .eq('id', userId)
    .limit(1)
    .maybeSingle();
  if (user) return NextResponse.json({ user });
  }
  // If no user session, try admin session table
  const { data: asess } = await supabase
    .from('admin_sessions')
    .select('admin_id, expires_at')
    .eq('token', token)
    .limit(1)
    .maybeSingle();
  if (!asess) return NextResponse.json({ user: null });
  if (new Date((asess as any).expires_at) <= new Date()) return NextResponse.json({ user: null });
  const adminId = (asess as any).admin_id as string;
  const { data: admin } = await supabase
    .from('admin_accounts')
    .select('id,email,username,created_at')
    .eq('id', adminId)
    .limit(1)
    .maybeSingle();
  if (admin) return NextResponse.json({ user: { ...admin, full_name: null, phone: null, location: null, role: 'admin' } });
  return NextResponse.json({ user: null });
}
