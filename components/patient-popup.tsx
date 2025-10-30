"use client";
import Link from 'next/link';
import { PatientWithStatus, Vitals } from '@/lib/patient-types';

function StatusPill({ status }: { status: 'normal'|'warning'|'critical' }) {
  const color = status === 'critical' ? 'bg-red-600' : status === 'warning' ? 'bg-amber-500' : 'bg-emerald-600';
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold text-white ${color}`}>{label}</span>;
}

export function PatientPopup({ p, onAcknowledge, onEmergency }: {
  p: PatientWithStatus,
  onAcknowledge?: () => void,
  onEmergency?: () => void,
}) {
  const v: Vitals = p.vitals;
  const last = new Date(p.lastUpdated);
  const lastLabel = isFinite(last.getTime()) ? last.toLocaleString() : '';
  const hasEmergency = p.emergency || p.vitals.fallDetected || p.status === 'critical';
  return (
    <div className="min-w-[240px] max-w-[320px]">
      <div className="mb-1 flex items-center justify-between gap-2">
        <h3 className="font-semibold text-sm text-gray-900 dark:text-white truncate">{p.name}</h3>
        <StatusPill status={p.status} />
      </div>
      {hasEmergency && (
        <div className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-red-600">
          <span className="inline-block w-2 h-2 rounded-full bg-red-600" /> Emergency
        </div>
      )}
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[12px] text-gray-800 dark:text-gray-200">
        <div><span className="text-gray-500">Heart Rate:</span> {v.heartRate ?? '—'} bpm</div>
        <div><span className="text-gray-500">SpO2:</span> {v.spo2 ?? '—'}%</div>
        <div><span className="text-gray-500">Body Temp:</span> {v.bodyTemp ?? '—'} °C</div>
        <div><span className="text-gray-500">Room:</span> {v.roomTemp ?? '—'} °C / {v.roomHumidity ?? '—'}%</div>
        <div><span className="text-gray-500">ECG:</span> {v.ecg ?? '—'}</div>
        <div><span className="text-gray-500">Fall:</span> {v.fallDetected ? 'Detected' : 'No'}</div>
      </div>
      <div className="mt-2 text-[11px] text-gray-500">Last updated: {lastLabel}</div>
      <div className="mt-2 flex items-center gap-2">
        <Link href={`/patients/${p.id}`} className="inline-flex items-center px-2.5 py-1 rounded-md bg-emerald-600 text-white text-[12px] font-medium hover:bg-emerald-500">Details</Link>
        {hasEmergency && (
          <button onClick={onAcknowledge} className="inline-flex items-center px-2.5 py-1 rounded-md bg-gray-200 dark:bg-gray-700 text-[12px] font-medium hover:bg-gray-300 dark:hover:bg-gray-600">Acknowledge</button>
        )}
        <button onClick={onEmergency} className="ml-auto inline-flex items-center px-2.5 py-1 rounded-md bg-red-600 text-white text-[12px] font-medium hover:bg-red-500">Emergency</button>
      </div>
    </div>
  );
}
