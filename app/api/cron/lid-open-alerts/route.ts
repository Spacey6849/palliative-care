import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase/client';
import { sendBinOpenReportEmail } from '@/lib/mailer';

// Runs a one-off scan: find bins with lid_open true for > 2 minutes since last closed
// and send an alert email to the owner. Idempotency is handled by checking the most recent
// alert timestamp stored in bin_metrics via an optional `alert_sent_at` field or by
// rate-limiting with a simple 30-minute backoff per bin using a cache table.
// Simpler approach (implemented): send at most once per hour per bin by tracking recent alerts in memory in dev
// and by a `bin_alerts` table in production if available.

// For this starter, we'll avoid schema changes and implement a conservative filter:
// - Consider a bin "open too long" if the latest metric shows lid_open=true and
//   its recorded_at is older than 2 minutes from now.
// - We will not repeat-send for the same bin within the same run. Scheduling tool (Netlify cron/Vercel cron)
//   should run this endpoint every few minutes.

export const dynamic = 'force-dynamic';

async function processAlerts(req: NextRequest) {
  const env = process.env as Record<string, string | undefined>;
  const cronSecret = env['CRON_SECRET'];
  // Basic auth: require header x-cron-secret to match CRON_SECRET
  const provided = req.headers.get('x-cron-secret') || req.headers.get('x-vercel-cron-secret') || '';
  if (!cronSecret || provided !== cronSecret) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const supabase = getSupabase();

  // 1) Fetch latest metric per bin that indicates lid state
  // We'll select from bin_metrics ordered by recorded_at desc and group in memory.
  const { data: latest, error: metricErr } = await supabase
    .from('bin_metrics')
    .select('bin_id, lid_open, recorded_at, fill_pct')
    .order('recorded_at', { ascending: false });

  if (metricErr) {
    return NextResponse.json({ ok: false, error: metricErr.message }, { status: 500 });
  }

  const latestByBin = new Map<string, { lid_open: boolean | null; recorded_at: string; fill_pct: number | null }>();
  for (const m of latest || []) {
    if (!latestByBin.has(m.bin_id as any)) {
      latestByBin.set(m.bin_id as any, { lid_open: (m as any).lid_open ?? null, recorded_at: (m as any).recorded_at, fill_pct: (m as any).fill_pct ?? null });
    }
  }

  // 2) Filter bins open for > 2 minutes
  const now = Date.now();
  const openTooLongIds: string[] = [];
  latestByBin.forEach((m: any, binId) => {
    const open = Boolean(m.lid_open);
    if (!open) return;
    const t = new Date(m.recorded_at).getTime();
    if (isFinite(t) && now - t >= 2 * 60 * 1000) {
      openTooLongIds.push(binId);
    }
  });

  if (openTooLongIds.length === 0) {
    return NextResponse.json({ ok: true, scanned: latestByBin.size, alerts: 0 });
  }

  // 3) Join with user_bins + users to get owner email and bin name
  const { data: bins, error: binsErr } = await supabase
    .from('user_bins')
    .select('id, name, location_label, bin_type, users(email)')
    .in('id', openTooLongIds);

  if (binsErr) {
    return NextResponse.json({ ok: false, error: binsErr.message }, { status: 500 });
  }

  // Optional backoff via bin_alerts table (if present): send at most once every 30 minutes per bin
  // If the table doesn't exist or RLS blocks, we gracefully fall back to stateless behavior
  const failures: any[] = [];
  let sent = 0;
  const nowIso = new Date().toISOString();
  const cutoffMs = 30 * 60 * 1000; // 30 minutes

  for (const b of bins || []) {
    const binId = (b as any).id as string;
    const email: string | undefined = (b as any).users?.email;
    const binName: string = (b as any).name || 'Your Bin';
    if (!email) continue;

    let allowed = true;
    try {
      // Check last alert time if table exists
      const { data: prev, error: prevErr } = await supabase
        .from('bin_alerts')
        .select('bin_id,last_alert_at')
        .eq('bin_id', binId)
        .maybeSingle();
      if (!prevErr && prev?.last_alert_at) {
        const last = new Date(prev.last_alert_at as any).getTime();
        if (isFinite(last) && Date.now() - last < cutoffMs) {
          allowed = false; // backoff window not elapsed
        }
      }
    } catch (e) {
      // Ignore table missing or RLS errors, proceed without backoff
    }

    if (!allowed) continue;
    try {
      const metric = latestByBin.get(binId as any) as any;
      const recordedAt = metric?.recorded_at ? new Date(metric.recorded_at).getTime() : Date.now();
      const minutesOpen = Math.max(2, Math.floor((Date.now() - recordedAt) / 60000));
      await sendBinOpenReportEmail({
        to: email,
        binName,
        minutesOpen,
        fillPct: metric?.fill_pct == null ? null : Number(metric.fill_pct),
        locationLabel: (b as any).location_label || null,
        binType: (b as any).bin_type || null,
      });
      sent += 1;
      try {
        // Upsert last alert time (best effort)
        await supabase.from('bin_alerts').upsert({ bin_id: binId, last_alert_at: nowIso }, { onConflict: 'bin_id' });
      } catch {}
    } catch (e: any) {
      failures.push({ binId, error: e?.message || String(e) });
    }
  }

  return NextResponse.json({ ok: true, scanned: latestByBin.size, candidates: openTooLongIds.length, sent, failures });
}

export async function GET(req: NextRequest) {
  return processAlerts(req);
}

export async function POST(req: NextRequest) {
  return processAlerts(req);
}
