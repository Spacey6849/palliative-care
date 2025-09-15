export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase/client';

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
  if (wantsJson) return NextResponse.json({ ok: true });
  return NextResponse.redirect(new URL('/auth?mode=login&verified=1', req.nextUrl.origin));
}
