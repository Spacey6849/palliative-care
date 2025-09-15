import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { randomUUID, createHash } from 'crypto';
import { getSupabase } from '@/lib/supabase/client';

function sessionToken(): string {
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
    const { identifier, password } = await req.json();
    if (!identifier || !password) return NextResponse.json({ error: 'Missing credentials' }, { status: 400 });

    const isEmail = identifier.includes('@');
    
    const { data: users, error: userErr } = await supabase
      .from('users')
      .select('id,password_hash,email_verified')
      .eq(isEmail ? 'email' : 'username', identifier.toLowerCase())
      .limit(1)
      .maybeSingle();
    if (userErr) throw userErr;
    if (!users) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    const user = users as any;
    const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  if ('email_verified' in user && user.email_verified === false) return NextResponse.json({ error: 'Email not verified' }, { status: 403 });

    const token = sessionToken();
    const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
    const { error: sessErr } = await supabase
      .from('sessions')
      .insert({ id: randomUUID(), user_id: user.id, token, expires_at: expires.toISOString() });
    if (sessErr) throw sessErr;

    const res = NextResponse.json({ ok: true });
    res.cookies.set('ecw_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      expires
    });
    return res;
  } catch (e) {
    console.error('Login error', e);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
