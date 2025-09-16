export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase/client';
import { createClient } from '@supabase/supabase-js';
import { randomUUID, createHash } from 'crypto';

export async function GET(req: NextRequest) {
  const supabase = getSupabase();
  const wantsJson = req.headers.get('accept')?.includes('application/json');
  const token = req.nextUrl.searchParams.get('token');
  if (!token) {
    if (wantsJson) return NextResponse.json({ error: 'Missing token' }, { status: 400 });
    return NextResponse.redirect(new URL('/auth?mode=login&verify_error=missing', req.nextUrl.origin));
  }
  
  const { data: user, error } = await supabase
    .from('users')
    .select('id,email_verified')
    .eq('email_verification_token', token)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!user) {
    if (wantsJson) return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
    return NextResponse.redirect(new URL('/auth?mode=login&verify_error=invalid', req.nextUrl.origin));
  }
  if ((user as any).email_verified) {
    if (wantsJson) return NextResponse.json({ ok: true, already_verified: true });
    return NextResponse.redirect(new URL('/auth?mode=login&verified=already', req.nextUrl.origin));
  }
  const { error: upErr } = await supabase
    .from('users')
    .update({ email_verified: true, email_verification_token: null })
    .eq('id', (user as any).id);
  if (upErr) throw upErr;
  // Auto-create a session on successful verification
  try {
    const env = process.env as Record<string, string | undefined>;
    const url = (env['NEXT_PUBLIC_SUPABASE_URL'] || '').trim();
    const serviceKey = (env['SUPABASE_SERVICE_ROLE_KEY'] || '').trim();
    if (url && serviceKey) {
      const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
      const sessionToken = createHash('sha256').update(randomUUID() + Date.now().toString()).digest('hex');
      const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7 days
      await admin.from('sessions').insert({ id: randomUUID(), user_id: (user as any).id, token: sessionToken, expires_at: expires.toISOString() });
      const res = wantsJson ? NextResponse.json({ ok: true, logged_in: true }) : NextResponse.redirect(new URL('/maps?verified=1', req.nextUrl.origin));
      res.cookies.set('bl_session', sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        expires
      });
      // Clean up legacy cookie if present
      res.cookies.set('ecw_session', '', { path: '/', maxAge: 0 });
      return res;
    }
  } catch (e) {
    // Non-fatal; fall back to redirecting to login
  }
  if (wantsJson) return NextResponse.json({ ok: true, logged_in: false });
  return NextResponse.redirect(new URL('/auth?mode=login&verified=1', req.nextUrl.origin));
}
