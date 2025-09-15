export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';
import { NextRequest, NextResponse } from 'next/server';
import { createHash, randomUUID } from 'crypto';
import { sendPasswordResetEmail } from '@/lib/mailer';
import { createClient } from '@supabase/supabase-js';

const stripQuotes = (v?: string | null) => (v || '').trim().replace(/^['"]|['"]$/g, '');
const stripInlineComment = (v: string) => v.replace(/\s+#.*$/, '');

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const identifier = (body.identifier || '').toString().trim();
    if (!identifier) return NextResponse.json({ ok: true }); // generic response to avoid enumeration

    const SUPABASE_URL = stripQuotes((process.env as Record<string, string | undefined>)["NEXT_PUBLIC_SUPABASE_URL"]);
    const SUPABASE_SERVICE_ROLE_KEY = stripInlineComment(stripQuotes(process.env.SUPABASE_SERVICE_ROLE_KEY));
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      // Still respond ok to client; log server misconfig
      console.warn('Forgot password: Supabase env missing');
      return NextResponse.json({ ok: true });
    }
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { 'X-Client-Info': 'ecowell-app/forgot-route' } }
    });

    // Verify schema has required columns; if not, return a generic service-unavailable message
    const probe = await sb.from('users').select('password_reset_token,password_reset_expires').limit(1);
    if (probe.error && /column\s+.*\s+does not exist/i.test(probe.error.message || '')) {
      console.warn('[forgot] users table missing password_reset_* columns');
      return NextResponse.json({ error: 'Password reset is temporarily unavailable. Please try again later.' }, { status: 503 });
    }

    const isEmail = identifier.includes('@');
    const { data: found } = await sb
      .from('users')
      .select('id,email')
      .eq(isEmail ? 'email' : 'username', identifier.toLowerCase())
      .limit(1)
      .maybeSingle();

  // Always return ok to the client (avoid enumeration)
  if (!found) return NextResponse.json({ ok: true });

    const token = createHash('sha256').update(randomUUID() + Date.now().toString()).digest('hex');
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 2).toISOString(); // 2 hours

    const { error: upErr } = await sb
      .from('users')
      .update({ password_reset_token: token, password_reset_expires: expiresAt })
      .eq('id', (found as any).id);

    if (upErr) {
      console.warn('Forgot password: update failed (likely missing columns). Admin action required.', upErr?.message || upErr);
      // Respond with a generic message but signal temporary service issue
      return NextResponse.json({ error: 'Password reset is temporarily unavailable. Please try again later.' }, { status: 503 });
    }

    try {
      await sendPasswordResetEmail((found as any).email, token);
    } catch (e) {
      console.warn('Forgot password: failed to send email', e);
    }

    return NextResponse.json({ ok: true });
  } catch (e:any) {
    console.error('Forgot password error', e);
    return NextResponse.json({ ok: true }); // generic
  }
}
