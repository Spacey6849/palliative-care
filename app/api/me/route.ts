import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase/client';

export async function GET() {
  const cookieStore = cookies();
  const token = cookieStore.get('ecw_session')?.value || cookieStore.get('ecw_admin_session')?.value;
  if (!token) return NextResponse.json({ user: null });
  const supabase = getSupabase();
  const { data: sess, error: sessErr } = await supabase
    .from('sessions')
    .select('user_id, expires_at')
    .eq('token', token)
    .limit(1)
    .maybeSingle();
  if (sessErr) return NextResponse.json({ user: null });
  if (!sess) return NextResponse.json({ user: null });
  if (new Date(sess.expires_at) <= new Date()) return NextResponse.json({ user: null });
  const userId = (sess as any).user_id as string;
  // Try normal user first
  const { data: user } = await supabase
    .from('users')
    .select('id,email,username,full_name,phone,panchayat_name,location,created_at')
    .eq('id', userId)
    .limit(1)
    .maybeSingle();
  if (user) return NextResponse.json({ user });
  // Fallback to admin
  const { data: admin } = await supabase
    .from('admin_accounts')
    .select('id,email,username,created_at')
    .eq('id', userId)
    .limit(1)
    .maybeSingle();
  if (admin) return NextResponse.json({ user: { ...admin, full_name: null, phone: null, panchayat_name: null, location: null } });
  return NextResponse.json({ user: null });
}
