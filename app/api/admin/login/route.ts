import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { randomUUID, createHash } from 'crypto';
import { getSupabase } from '@/lib/supabase/client';
import { createClient } from '@supabase/supabase-js';

function token(): string {
  return createHash('sha256').update(randomUUID() + Date.now().toString()).digest('hex');
}

// Helpers similar to user login route
const stripQuotes = (v?: string | null) => (v || '').trim().replace(/^['"]|['"]$/g, '');
const stripInlineComment = (v: string) => v.replace(/\s+#.*$/, '');

export async function POST(req: NextRequest) {
  try {
    const env = process.env as Record<string, string | undefined>;
    const url = stripQuotes(env['NEXT_PUBLIC_SUPABASE_URL'] || env['SUPABASE_URL']);
    const serviceKey = stripInlineComment(stripQuotes(env['SUPABASE_SERVICE_ROLE_KEY']));
    if (!url || !serviceKey) return NextResponse.json({ error: 'Server misconfigured: missing Supabase URL or service key' }, { status: 500 });
    const adminClient = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    const { username, password } = await req.json();
    if (!username || !password) return NextResponse.json({ error: 'Missing credentials' }, { status: 400 });

    
    const ident = String(username).trim().toLowerCase();
    const { data: admin, error } = await adminClient
      .from('admin_accounts')
      .select('id,password_hash')
      .or(`username.eq.${ident},email.eq.${ident}`)
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!admin) return NextResponse.json({ error: 'Invalid admin credentials (not found)' }, { status: 401 });

    const ok = await bcrypt.compare(password, (admin as any).password_hash);
  if (!ok) return NextResponse.json({ error: 'Invalid admin credentials (password mismatch)' }, { status: 401 });

    const t = token();
    const expires = new Date(Date.now() + 1000 * 60 * 60 * 12);
    // Store admin sessions separately to avoid FK constraint on sessions.user_id -> users.id
    const { error: sessErr } = await adminClient
      .from('admin_sessions')
      .insert({ id: randomUUID(), admin_id: (admin as any).id, token: t, expires_at: expires.toISOString() });
    if (sessErr) throw sessErr;

    const res = NextResponse.json({ ok: true, admin: true });
    // Unify session cookie so the rest of the app recognizes admin as well
    res.cookies.set('bl_session', t, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      expires
    });
    // Clear old cookie if present
    res.cookies.set('ecw_admin_session', '', { path: '/', maxAge: 0 });
    return res;
  } catch (e) {
    console.error('Admin login error', e);
    return NextResponse.json({ error: 'Admin auth failed' }, { status: 500 });
  }
}

