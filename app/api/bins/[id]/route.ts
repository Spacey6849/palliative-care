import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSupabase } from '@/lib/supabase/client';

async function getSessionUser() {
  const supabase = getSupabase();
  const cookieStore = cookies();
  const token = cookieStore.get('bl_session')?.value || cookieStore.get('ecw_session')?.value || cookieStore.get('ecw_admin_session')?.value;
  if (!token) return { userId: null as string | null, isAdmin: false };
  // Try user sessions, then admin sessions
  const { data: sess } = await supabase
    .from('sessions')
    .select('user_id, expires_at')
    .eq('token', token)
    .limit(1)
    .maybeSingle();
  if (sess && new Date((sess as any).expires_at) > new Date()) {
    const userId = (sess as any).user_id as string;
    let isAdmin = false;
    try {
      const { data: admin } = await supabase.from('admin_accounts').select('id').eq('id', userId).limit(1).maybeSingle();
      isAdmin = !!admin;
    } catch {}
    return { userId, isAdmin };
  }
  const { data: asess } = await supabase
    .from('admin_sessions')
    .select('admin_id, expires_at')
    .eq('token', token)
    .limit(1)
    .maybeSingle();
  if (asess && new Date((asess as any).expires_at) > new Date()) {
    return { userId: null, isAdmin: true };
  }
  return { userId: null, isAdmin: false };
}

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const supabase = getSupabase();
  const { userId, isAdmin } = await getSessionUser();
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const sel = 'id,user_id,name,bin_type,location_label,lat,lng,status,last_fill_pct,is_open,last_seen_at,created_at';
  const q = supabase.from('user_bins').select(sel).eq('id', params.id).limit(1).maybeSingle();
  const { data: row, error } = await q;
  if (error || !row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!isAdmin && row.user_id !== userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  return NextResponse.json({ bin: row });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = getSupabase();
  const { userId, isAdmin } = await getSessionUser();
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 });
  // Check ownership
  const { data: row } = await supabase.from('user_bins').select('user_id').eq('id', params.id).limit(1).maybeSingle();
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!isAdmin && row.user_id !== userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { error } = await supabase.from('user_bins').update({ name }).eq('id', params.id);
  if (error) return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const supabase = getSupabase();
  const { userId, isAdmin } = await getSessionUser();
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  // Check ownership
  const { data: row } = await supabase.from('user_bins').select('user_id').eq('id', params.id).limit(1).maybeSingle();
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!isAdmin && row.user_id !== userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { error } = await supabase.from('user_bins').delete().eq('id', params.id);
  if (error) return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
