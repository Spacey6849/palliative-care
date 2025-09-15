import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSupabase } from '@/lib/supabase/client';

export async function GET() {
  const supabase = getSupabase();
  const cookieStore = cookies();
  const token = cookieStore.get('ecw_session')?.value || cookieStore.get('ecw_admin_session')?.value;
  if (!token) {
    return NextResponse.json({ wells: [] });
  }
  
  const { data: sess } = await supabase
    .from('sessions')
    .select('user_id, expires_at')
    .eq('token', token)
    .limit(1)
    .maybeSingle();
  if (!sess || new Date((sess as any).expires_at) <= new Date()) return NextResponse.json({ wells: [] });
  const userId = (sess as any).user_id as string;
  // Determine if this session belongs to an admin (user_id matches an admin_accounts id)
  let isAdmin = false;
  try {
    const { data: admin } = await supabase.from('admin_accounts').select('id').eq('id', userId).limit(1).maybeSingle();
    isAdmin = !!admin;
  } catch {}
  try {
    
    let wells: any[] = [];
    if (isAdmin) {
      const { data } = await supabase
        .from('user_wells')
        .select('id,user_id,name,panchayat_name,lat,lng,status, created_at, users(phone,location)')
        .order('created_at', { ascending: true });
      wells = (data || []).map((w: any) => ({
        ...w,
        phone: w.users?.phone || null,
        location: w.users?.location || null
      }));
    } else {
      const { data } = await supabase
        .from('user_wells')
        .select('id,user_id,name,panchayat_name,lat,lng,status, created_at, users(phone,location)')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });
      wells = (data || []).map((w: any) => ({
        ...w,
        phone: w.users?.phone || null,
        location: w.users?.location || null
      }));
    }
    // Attach latest metrics per well
    const wellIds = wells.map(w => w.id);
    let latestById: Record<string, any> = {};
    if (wellIds.length) {
      const { data: metrics } = await supabase
        .from('well_metrics')
        .select('well_id, ph, tds, temperature, water_level, ts')
        .in('well_id', wellIds)
        .order('ts', { ascending: false });
      for (const m of metrics || []) {
        if (!latestById[m.well_id]) latestById[m.well_id] = m;
      }
    }
    const result = wells.map(w => ({
      ...w,
      ph: latestById[w.id]?.ph ?? null,
      tds: latestById[w.id]?.tds ?? null,
      temperature: latestById[w.id]?.temperature ?? null,
      water_level: latestById[w.id]?.water_level ?? null,
      last_ts: latestById[w.id]?.ts ?? null
    }));
    return NextResponse.json({ wells: result });
  } catch (e) {
    return NextResponse.json({ wells: [] });
  }
}

export async function POST(req: Request) {
  const supabase = getSupabase();
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('ecw_session')?.value || cookieStore.get('ecw_admin_session')?.value;
    if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    
    const { data: sess } = await supabase
      .from('sessions')
      .select('user_id, expires_at')
      .eq('token', token)
      .limit(1)
      .maybeSingle();
    if (!sess || new Date((sess as any).expires_at) <= new Date()) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    const sessionUserId = (sess as any).user_id as string;
    let actingAsUserId = sessionUserId;
    let isAdmin = false;
    try {
      const { data: admin } = await supabase.from('admin_accounts').select('id').eq('id', sessionUserId).limit(1).maybeSingle();
      isAdmin = !!admin;
    } catch {}
    const body = await req.json();
    const wells = Array.isArray(body.wells) ? body.wells : [];
    if (isAdmin && body.user_id) {
      actingAsUserId = body.user_id; // allow admin to specify target user
    }
    if (!wells.length) return NextResponse.json({ ok: true, count: 0 });
    for (const w of wells) {
      try {
        // Upsert by primary key id
        await supabase
          .from('user_wells')
          .upsert({
            id: w.id,
            user_id: actingAsUserId,
            name: w.name,
            panchayat_name: w.panchayat_name || null,
            lat: w.location?.lat,
            lng: w.location?.lng,
            status: w.status || 'active'
          }, { onConflict: 'id' });
      } catch (e) {
        // ignore individual errors
      }
    }
    return NextResponse.json({ ok: true, count: wells.length });
  } catch (e) {
    return NextResponse.json({ error: 'Save failed' }, { status: 500 });
  }
}
