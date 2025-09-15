export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { createClient } from '@supabase/supabase-js';

const stripQuotes = (v?: string | null) => (v || '').trim().replace(/^['"]|['"]$/g, '');
const stripInlineComment = (v: string) => v.replace(/\s+#.*$/, '');

export async function POST(req: NextRequest) {
  try {
    const { token, password } = await req.json();
    if (!token || !password) return NextResponse.json({ error: 'Missing token or password' }, { status: 400 });
    if (typeof password !== 'string' || password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    const SUPABASE_URL = stripQuotes((process.env as Record<string, string | undefined>)["NEXT_PUBLIC_SUPABASE_URL"]);
    const SUPABASE_SERVICE_ROLE_KEY = stripInlineComment(stripQuotes(process.env.SUPABASE_SERVICE_ROLE_KEY));
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 503 });
    }
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { 'X-Client-Info': 'ecowell-app/reset-route' } }
    });

    // Verify required columns exist; if not, surface a temporary-unavailable error
    const probe = await sb.from('users').select('password_reset_token,password_reset_expires').limit(1);
    if (probe.error && /column\s+.*\s+does not exist/i.test(probe.error.message || '')) {
      console.warn('[reset] users table missing password_reset_* columns');
      return NextResponse.json({ error: 'Password reset is temporarily unavailable. Please try again later.' }, { status: 503 });
    }

    const nowIso = new Date().toISOString();
    const { data: user } = await sb
      .from('users')
      .select('id,password_reset_expires')
      .eq('password_reset_token', token)
      .limit(1)
      .maybeSingle();

    if (!user) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 400 });
    const exp = (user as any).password_reset_expires as string | null;
    if (!exp || exp < nowIso) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 400 });
    }

    const hash = await bcrypt.hash(password, 10);
    const { error: upErr } = await sb
      .from('users')
      .update({ password_hash: hash, password_reset_token: null, password_reset_expires: null })
      .eq('id', (user as any).id);

  if (upErr) throw upErr;

    return NextResponse.json({ ok: true });
  } catch (e:any) {
    console.error('Reset password error', e);
    return NextResponse.json({ error: 'Reset failed' }, { status: 500 });
  }
}
