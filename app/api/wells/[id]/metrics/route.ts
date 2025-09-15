import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSupabase } from '@/lib/supabase/client';

// GET /api/wells/[id]/metrics -> last 24h of metrics points for a well (owned by user or any if admin)
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = getSupabase();
  const wellId = params.id;
  if (!wellId) return NextResponse.json({ metrics: [] });
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('ecw_session')?.value || cookieStore.get('ecw_admin_session')?.value;
    if (!token) return NextResponse.json({ metrics: [] }, { status: 200 }); // treat as no data for guests
    
    const { data: sess } = await supabase
      .from('sessions')
      .select('user_id, expires_at')
      .eq('token', token)
      .limit(1)
      .maybeSingle();
    if (!sess || new Date((sess as any).expires_at) <= new Date()) return NextResponse.json({ metrics: [] }, { status: 200 });
    const userId = (sess as any).user_id as string;
    let isAdmin = false;
    try {
      const { data: admin } = await supabase.from('admin_accounts').select('id').eq('id', userId).limit(1).maybeSingle();
      isAdmin = !!admin;
    } catch {}
    // Ownership check (skip if admin)
    if (!isAdmin) {
      const { data: own } = await supabase.from('user_wells').select('user_id').eq('id', wellId).limit(1).maybeSingle();
      if (!own || (own as any).user_id !== userId) {
        return NextResponse.json({ metrics: [] }, { status: 200 });
      }
    }
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: rows } = await supabase
      .from('well_metrics')
      .select('ph,tds,temperature,water_level,ts')
      .eq('well_id', wellId)
      .gte('ts', since)
      .order('ts', { ascending: true });
    const metrics = (rows || []).map(r => ({
      ph: r.ph === null ? null : Number(r.ph),
      tds: r.tds === null ? null : Number(r.tds),
      temperature: r.temperature === null ? null : Number(r.temperature),
      waterLevel: r.water_level === null ? null : Number(r.water_level),
      timestamp: r.ts
    }));
    return NextResponse.json({ metrics });
  } catch (e) {
    return NextResponse.json({ metrics: [] }, { status: 200 });
  }
}
