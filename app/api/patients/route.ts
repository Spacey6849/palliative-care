import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase/client';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Return patient list with latest vitals and computed status
export async function GET() {
  const sb = getSupabase();
  try {
    const { data, error } = await sb
      .from('patient_status')
      .select('*')
      .order('full_name', { ascending: true });
    if (error) throw error;
    const patients = (data || []).map((p: any) => ({
      id: p.id,
      full_name: p.full_name,
      lat: p.lat,
      lng: p.lng,
      emergency: !!p.emergency,
      last_updated: p.last_updated,
      heart_rate: p.heart_rate,
      spo2: p.spo2,
      body_temp: p.body_temp,
      room_temp: p.room_temp,
      room_humidity: p.room_humidity,
      ecg: p.ecg,
      fall_detected: !!p.fall_detected,
      status: p.status || 'normal',
    }));
    return NextResponse.json({ patients }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return NextResponse.json({ patients: [] }, { headers: { 'Cache-Control': 'no-store' } });
  }
}

// Create a new patient
export async function POST(req: Request) {
  const sb = getSupabase();
  try {
    // Basic session check: allow if user session or admin session valid
    const cookieStore = cookies();
    const token = cookieStore.get('bl_session')?.value || cookieStore.get('ecw_session')?.value || cookieStore.get('ecw_admin_session')?.value;
    if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    let authed = false;
    const { data: sess } = await sb.from('sessions').select('expires_at').eq('token', token).limit(1).maybeSingle();
    if (sess && new Date((sess as any).expires_at) > new Date()) authed = true;
    if (!authed) {
      const { data: asess } = await sb.from('admin_sessions').select('expires_at').eq('token', token).limit(1).maybeSingle();
      if (asess && new Date((asess as any).expires_at) > new Date()) authed = true;
    }
    if (!authed) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });

    const body = await req.json();
    const payload: any = {
      full_name: String(body.full_name || '').trim(),
      device_id: body.device_id ? String(body.device_id).trim() : null,
      gender: body.gender ?? null,
      dob: body.dob ?? null,
      address: body.address ?? null,
      patient_email: body.patient_email ?? null,
      patient_phone: body.patient_phone ?? null,
      emergency_contact_name: body.emergency_contact_name ?? null,
      emergency_contact_phone: body.emergency_contact_phone ?? null,
      emergency_contact_email: body.emergency_contact_email ?? null,
      lat: typeof body.lat === 'number' ? body.lat : (body.lat ? Number(body.lat) : null),
      lng: typeof body.lng === 'number' ? body.lng : (body.lng ? Number(body.lng) : null),
    };
    if (!payload.full_name) return NextResponse.json({ error: 'full_name required' }, { status: 400 });
    if (!payload.device_id) return NextResponse.json({ error: 'device_id required' }, { status: 400 });
    if (typeof payload.lat !== 'number' || typeof payload.lng !== 'number' || Number.isNaN(payload.lat) || Number.isNaN(payload.lng)) {
      return NextResponse.json({ error: 'lat/lng required' }, { status: 400 });
    }

    const { data, error } = await sb.from('patients').insert(payload).select('id').single();
    if (error) {
      const msg = String(error.message || '').toLowerCase();
      if (msg.includes('duplicate') || msg.includes('unique')) {
        return NextResponse.json({ error: 'Device ID already registered' }, { status: 409 });
      }
      return NextResponse.json({ error: 'Insert failed' }, { status: 500 });
    }
    return NextResponse.json({ ok: true, id: (data as any)?.id });
  } catch (e) {
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 });
  }
}
