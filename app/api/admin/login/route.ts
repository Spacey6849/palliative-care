import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { randomUUID, createHash } from 'crypto';
import { getSupabase } from '@/lib/supabase/client';

function token(): string {
  return createHash('sha256').update(randomUUID() + Date.now().toString()).digest('hex');
}

export async function POST(req: NextRequest) {
  try {
    let supabase;
    try {
      supabase = getSupabase();
    } catch (e:any) {
      return NextResponse.json({ error: e?.message || 'Supabase not configured' }, { status: 503 });
    }
    const { username, password } = await req.json();
    if (!username || !password) return NextResponse.json({ error: 'Missing credentials' }, { status: 400 });

    
    const { data: admin, error } = await supabase
      .from('admin_accounts')
      .select('id,password_hash')
      .or(`username.eq.${username.toLowerCase()},email.eq.${username.toLowerCase()}`)
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!admin) return NextResponse.json({ error: 'Invalid admin credentials (not found)' }, { status: 401 });

    const ok = await bcrypt.compare(password, (admin as any).password_hash);
  if (!ok) return NextResponse.json({ error: 'Invalid admin credentials (password mismatch)' }, { status: 401 });

    const t = token();
    const expires = new Date(Date.now() + 1000 * 60 * 60 * 12);
    const { error: sessErr } = await supabase
      .from('sessions')
      .insert({ id: randomUUID(), user_id: (admin as any).id, token: t, expires_at: expires.toISOString() });
    if (sessErr) throw sessErr;

    const res = NextResponse.json({ ok: true, admin: true });
    res.cookies.set('ecw_admin_session', t, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      expires
    });
    return res;
  } catch (e) {
    console.error('Admin login error', e);
    return NextResponse.json({ error: 'Admin auth failed' }, { status: 500 });
  }
}

