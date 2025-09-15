export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { createHash, randomUUID } from 'crypto';
import { sendVerificationEmail } from '@/lib/mailer';
import { getSupabase } from '@/lib/supabase/client';

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const { email } = await req.json();
    if (!email) return NextResponse.json({ error: 'Missing email' }, { status: 400 });
    
    const { data: user, error } = await supabase
      .from('users')
      .select('id,email_verified')
      .eq('email', email.toLowerCase())
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    if ((user as any).email_verified) return NextResponse.json({ ok: true, already_verified: true });
    const token = createHash('sha256').update(randomUUID() + Date.now().toString()).digest('hex');
    const { error: upErr } = await supabase
      .from('users')
      .update({ email_verification_token: token, email_verification_sent_at: new Date().toISOString() })
      .eq('id', (user as any).id);
    if (upErr) throw upErr;
    try { await sendVerificationEmail(email.toLowerCase(), token); } catch (e) { console.warn('Resend email failed', e); }
    return NextResponse.json({ ok: true, resent: true });
  } catch (e) {
    console.error('Resend verification error', e);
    return NextResponse.json({ error: 'Resend failed' }, { status: 500 });
  }
}