import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { randomUUID, createHash } from 'crypto';
import { getSupabase } from '@/lib/supabase/client';
import { createClient } from '@supabase/supabase-js';

function sessionToken(): string {
  return createHash('sha256').update(randomUUID() + Date.now().toString()).digest('hex');
}

// Helpers to sanitize env values; mirrors signup route behavior
const stripQuotes = (v?: string | null) => (v || '').trim().replace(/^['"]|['"]$/g, '');
const stripInlineComment = (v: string) => v.replace(/\s+#.*$/, '');
const getRefFromUrl = (url: string) => {
  const m = url.match(/^https:\/\/([a-zA-Z0-9-]+)\.supabase\.(co|in)(?:\/|$)/);
  return m ? m[1] : null;
};
const getRefFromKey = (key: string) => {
  try {
    const payload = key.split('.')[1] || '';
    const json = Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    const d = JSON.parse(json || '{}');
    return d?.ref || null;
  } catch {
    return null;
  }
};

export async function POST(req: NextRequest) {
  try {
    // Prefer service-role client for reliable reads/writes regardless of RLS
  const env = process.env as Record<string, string | undefined>;
  const url = stripQuotes(env['NEXT_PUBLIC_SUPABASE_URL'] || env['SUPABASE_URL']);
  const serviceKey = stripInlineComment(stripQuotes(env['SUPABASE_SERVICE_ROLE_KEY']));
    if (!url || !serviceKey) return NextResponse.json({ error: 'Server misconfigured: missing Supabase URL or service key' }, { status: 500 });
    // Validate key belongs to URL project (avoids Invalid API key from cross-project pairing)
    const urlRef = getRefFromUrl(url);
    const keyRef = getRefFromKey(serviceKey);
    if (urlRef && keyRef && urlRef !== keyRef) {
      return NextResponse.json({ error: `Supabase project mismatch: URL ref ${urlRef} != key ref ${keyRef}. Update NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to the same project.` }, { status: 500 });
    }
    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    const { identifier, password } = await req.json();
    if (!identifier || !password) return NextResponse.json({ error: 'Missing credentials' }, { status: 400 });

    const isEmail = identifier.includes('@');
    
    const { data: users, error: userErr } = await admin
      .from('users')
      .select('id,password_hash,email_verified')
      .eq(isEmail ? 'email' : 'username', identifier.toLowerCase())
      .limit(1)
      .maybeSingle();
    if (userErr) {
      // Surface more helpful message on key issues
      const msg = (userErr as any)?.message?.toLowerCase?.() || '';
      if (msg.includes('api key')) {
        return NextResponse.json({ error: 'Supabase rejected the API key. Verify SUPABASE_SERVICE_ROLE_KEY matches NEXT_PUBLIC_SUPABASE_URL project.' }, { status: 500 });
      }
      throw userErr;
    }
    if (!users) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    const user = users as any;
    const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  if ('email_verified' in user && user.email_verified === false) return NextResponse.json({ error: 'Email not verified' }, { status: 403 });

    const token = sessionToken();
    const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
    // Use service-role client for inserting sessions to avoid RLS issues
    const { error: sessErr } = await admin.from('sessions').insert({ id: randomUUID(), user_id: user.id, token, expires_at: expires.toISOString() });
    if (sessErr) {
      const msg = (sessErr as any)?.message?.toLowerCase?.() || '';
      if (msg.includes('api key')) {
        return NextResponse.json({ error: 'Supabase rejected the API key while creating session. Check SUPABASE_SERVICE_ROLE_KEY and project URL.' }, { status: 500 });
      }
      throw sessErr;
    }

    const res = NextResponse.json({ ok: true });
    res.cookies.set('bl_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      expires
    });
    // Clear legacy cookie name if present
    res.cookies.set('ecw_session', '', { path: '/', maxAge: 0 });
    return res;
  } catch (e) {
    console.error('Login error', e);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
