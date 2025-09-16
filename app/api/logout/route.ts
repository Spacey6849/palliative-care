import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase/client';
import { createClient } from '@supabase/supabase-js';

export async function POST() {
  const supabase = getSupabase();
  const cookieStore = cookies();
  const blToken = cookieStore.get('bl_session')?.value;
  const sessionToken = cookieStore.get('ecw_session')?.value;
  const adminToken = cookieStore.get('ecw_admin_session')?.value;

  const env = process.env as Record<string, string | undefined>;
  const url = (env['NEXT_PUBLIC_SUPABASE_URL'] || '').trim();
  const serviceKey = (env['SUPABASE_SERVICE_ROLE_KEY'] || '').trim();
  const admin = url && serviceKey ? createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }) : null;

  const deleter = async (t?: string) => {
    if (!t) return;
    try { if (admin) await admin.from('sessions').delete().eq('token', t); else await supabase.from('sessions').delete().eq('token', t); } catch {}
    try { if (admin) await admin.from('admin_sessions').delete().eq('token', t); else await supabase.from('admin_sessions').delete().eq('token', t); } catch {}
  };
  await Promise.all([deleter(blToken), deleter(sessionToken), deleter(adminToken)]);

  const res = NextResponse.json({ ok: true });
  res.cookies.set('bl_session', '', { path: '/', maxAge: 0 });
  if (sessionToken) res.cookies.set('ecw_session', '', { path: '/', maxAge: 0 });
  if (adminToken) res.cookies.set('ecw_admin_session', '', { path: '/', maxAge: 0 });
  return res;
}
