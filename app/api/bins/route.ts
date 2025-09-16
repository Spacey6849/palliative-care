import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSupabase } from '@/lib/supabase/client';

// Bins API backed by user_bins and bin_metrics

export async function GET() {
  const supabase = getSupabase();
  const cookieStore = cookies();
  const token = cookieStore.get('bl_session')?.value || cookieStore.get('ecw_session')?.value || cookieStore.get('ecw_admin_session')?.value;
  if (!token) return NextResponse.json({ bins: [] });

  // Prefer user session; if absent, try admin session
  const { data: sess } = await supabase
    .from('sessions')
    .select('user_id, expires_at')
    .eq('token', token)
    .limit(1)
    .maybeSingle();
  let userId: string | null = null;
  let isAdmin = false;
  if (sess && new Date((sess as any).expires_at) > new Date()) {
    userId = (sess as any).user_id as string;
  } else {
    const { data: asess } = await supabase
      .from('admin_sessions')
      .select('admin_id, expires_at')
      .eq('token', token)
      .limit(1)
      .maybeSingle();
    if (asess && new Date((asess as any).expires_at) > new Date()) {
      isAdmin = true;
    } else {
      return NextResponse.json({ bins: [] });
    }
  }

  try {
    // Fetch bins for user or all if admin
    const sel = 'id,user_id,name,bin_type,location_label,lat,lng,status,last_fill_pct,is_open,last_seen_at,created_at,users(email)';
    const q = supabase.from('user_bins').select(sel).order('created_at', { ascending: true });
  const { data: rows, error } = isAdmin ? await q : await q.eq('user_id', userId as string);
    if (error) throw error;

    const ids = (rows || []).map(r => r.id);
    // Get latest metric per bin
    const latestById: Record<string, any> = {};
    if (ids.length) {
      const { data: metrics } = await supabase
        .from('bin_metrics')
        .select('bin_id, bin_name, recorded_at, fill_pct, is_open')
        .in('bin_id', ids)
        .order('recorded_at', { ascending: false });
      for (const m of metrics || []) if (!latestById[m.bin_id]) latestById[m.bin_id] = m;
    }

    const bins = (rows || []).map((b: any) => {
      const m = latestById[b.id];
      const fill_pct = m?.fill_pct ?? b.last_fill_pct ?? null;
      const is_open = m?.is_open ?? (b.is_open ?? null);
      return {
        id: b.id,
        name: b.name,
        label: b.location_label || null,
        owner_id: b.user_id,
        owner_email: b.users?.email || null,
        location: { lat: b.lat, lng: b.lng },
        status: b.status || 'active',
        fill_pct: fill_pct == null ? null : Math.max(0, Math.min(100, Number(fill_pct))),
        is_open: is_open == null ? null : !!is_open,
        updated_at: m?.recorded_at || b.last_seen_at || b.created_at,
      };
    });
    return NextResponse.json({ bins });
  } catch (e) {
    return NextResponse.json({ bins: [] });
  }
}

export async function POST(req: Request) {
  const supabase = getSupabase();
  try {
    const cookieStore = cookies();
  const token = cookieStore.get('bl_session')?.value || cookieStore.get('ecw_session')?.value || cookieStore.get('ecw_admin_session')?.value;
    if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { data: sess } = await supabase
      .from('sessions')
      .select('user_id, expires_at')
      .eq('token', token)
      .limit(1)
      .maybeSingle();
    let actingAsUserId: string | null = null;
    let isAdmin = false;
    if (sess && new Date((sess as any).expires_at) > new Date()) {
      actingAsUserId = (sess as any).user_id as string;
    } else {
      const { data: asess } = await supabase
        .from('admin_sessions')
        .select('admin_id, expires_at')
        .eq('token', token)
        .limit(1)
        .maybeSingle();
      if (asess && new Date((asess as any).expires_at) > new Date()) {
        isAdmin = true;
      } else {
        return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
      }
    }

    const body = await req.json();
    const bins = Array.isArray(body.bins) ? body.bins : [];
  if (isAdmin && body.user_id) actingAsUserId = body.user_id;
    if (!bins.length) return NextResponse.json({ ok: true, count: 0 });

    for (const b of bins) {
      try {
        await supabase
          .from('user_bins')
          .upsert({
            id: b.id,
            user_id: actingAsUserId as string,
            name: b.name,
            bin_type: (b.bin_type as any) || 'private',
            location_label: b.label || b.location_label || null,
            lat: b.location?.lat,
            lng: b.location?.lng,
            status: b.status || 'active',
            last_fill_pct: typeof b.data?.fill_pct === 'number' ? Math.max(0, Math.min(100, Math.round(b.data.fill_pct))) : (typeof b.fill_pct === 'number' ? b.fill_pct : null),
            is_open: typeof b.data?.is_open === 'boolean' ? b.data.is_open : (typeof b.is_open === 'boolean' ? b.is_open : null),
            last_seen_at: new Date().toISOString(),
          }, { onConflict: 'id' });
      } catch {}
    }
    return NextResponse.json({ ok: true, count: bins.length });
  } catch (e) {
    return NextResponse.json({ error: 'Save failed' }, { status: 500 });
  }
}
