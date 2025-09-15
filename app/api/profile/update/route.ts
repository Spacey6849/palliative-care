import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSupabase } from '@/lib/supabase/client';

export async function POST(req: NextRequest) {
  const supabase = getSupabase();
  try {
    const body = await req.json();
    const { full_name, panchayat_name, location, phone } = body;
    const cookieStore = cookies();
    const token = cookieStore.get('ecw_session')?.value || cookieStore.get('ecw_admin_session')?.value;
    if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    
    const { data: sess } = await supabase
      .from('sessions')
      .select('user_id, expires_at')
      .eq('token', token)
      .limit(1)
      .maybeSingle();
    if (!sess || new Date((sess as any).expires_at) <= new Date()) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    const userId = (sess as any).user_id as string;
    const { error } = await supabase
      .from('users')
      .update({ full_name: full_name || null, panchayat_name: panchayat_name || null, location: location || null, phone: phone || null })
      .eq('id', userId);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('Profile update error', e);
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }
}
