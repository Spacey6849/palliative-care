import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getTransport } from '@/lib/mailer';

const stripQuotes = (v?: string | null) => (v || '').trim().replace(/^['"]|['"]$/g, '');
const stripInlineComment = (v: string) => v.replace(/\s+#.*$/, '');

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const env = process.env as Record<string, string | undefined>;
    const url = stripQuotes(env['NEXT_PUBLIC_SUPABASE_URL'] || env['SUPABASE_URL']);
    const serviceKey = stripInlineComment(stripQuotes(env['SUPABASE_SERVICE_ROLE_KEY']));
    if (!url || !serviceKey) return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
    const adminClient = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });

    const id = params.id;
    const body = await req.json().catch(() => ({}));
    const note: string = (body?.note || '').toString();
    const reason: string = (body?.reason || 'manual').toString();
    const fill_pct: number | undefined = typeof body?.fill_pct === 'number' ? body.fill_pct : undefined;
    const is_open: boolean | undefined = typeof body?.is_open === 'boolean' ? body.is_open : undefined;

    // Fetch bin and owner
    const { data: bin, error: binErr } = await adminClient
      .from('user_bins')
      .select('id, name, bin_type, location_label, user_id')
      .eq('id', id)
      .limit(1)
      .maybeSingle();
    if (binErr || !bin) return NextResponse.json({ error: 'Bin not found' }, { status: 404 });

    const { data: owner, error: userErr } = await adminClient
      .from('users')
      .select('email, username, full_name')
      .eq('id', bin.user_id)
      .limit(1)
      .maybeSingle();
    if (userErr || !owner?.email) return NextResponse.json({ error: 'Owner email not found' }, { status: 404 });

    // Compose email
    const transport = getTransport();
    const from = env['MAIL_FROM'] || 'alerts@binlink.local';
    const to = owner.email;
    const name = bin.name || 'Bin';
    const parts: string[] = [];
    if (typeof fill_pct === 'number') {
      const pct = Math.round(fill_pct);
      let statusMsg = `Bin Fill level is ${pct}%`;
      if (pct >= 100) statusMsg += ' (FULL)';
      else if (pct > 80) statusMsg += ' (ALMOST FULL)';
      parts.push(statusMsg);
    }
    if (typeof is_open === 'boolean') parts.push(`Bin Lid is ${is_open ? 'Open' : 'Closed'}`);
    if (bin.location_label) parts.push(`Location: ${bin.location_label}`);
    if (bin.bin_type) parts.push(`Bin Type: ${String(bin.bin_type).toUpperCase()}`);
    if (note && note.trim()) parts.push(`Note: ${note.trim()}`);

    const subjectBase = `[BinLink] ${name} Report`;
    let subj = subjectBase;
    if (fill_pct != null) {
      const pct = Math.round(fill_pct);
      if (pct >= 100) subj = `[BinLink] ${name} FULL (100%)`;
      else if (pct > 80) subj = `[BinLink] ${name} nearly full (${pct}%)`;
      else subj = `${subjectBase} – Fill ${pct}%`;
    }
    const text = parts.join('\n');
    const html = `<div>${parts.map(p => `<p>${escapeHtml(p)}</p>`).join('')}</div>`;

    await transport.sendMail({ from, to, subject: subj, text, html });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to send report' }, { status: 500 });
  }
}

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
