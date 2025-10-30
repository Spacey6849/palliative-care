import { NextResponse } from 'next/server';
import { patientStore } from '@/lib/patient-store';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const id = params.id;
  const body = await req.json().catch(() => ({}));
  const emergency = typeof body.emergency === 'boolean' ? body.emergency : true;
  const p = patientStore.setEmergency(id, emergency);
  if (!p) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ ok: true, id, emergency: p.emergency });
}
