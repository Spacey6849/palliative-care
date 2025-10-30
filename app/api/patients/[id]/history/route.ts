import { NextResponse } from 'next/server';
import { patientStore } from '@/lib/patient-store';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const id = params.id;
  const data = patientStore.historyFor(id);
  return NextResponse.json({ id, history: data }, { headers: { 'Cache-Control': 'no-store' } });
}
