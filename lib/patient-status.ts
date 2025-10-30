import { Vitals } from './patient-types';

export function classify(v: Vitals): { level: 'normal' | 'warning' | 'critical'; reasons: string[] } {
  const reasons: string[] = [];
  let level: 'normal' | 'warning' | 'critical' = 'normal';

  if (v.spo2 < 85) { level = 'critical'; reasons.push(`SpO2 ${v.spo2}%`); }
  else if (v.spo2 < 90) { level = max(level, 'warning'); reasons.push(`SpO2 ${v.spo2}%`); }

  if (v.heartRate < 40 || v.heartRate > 140) { level = 'critical'; reasons.push(`HR ${v.heartRate}`); }
  else if (v.heartRate < 50 || v.heartRate > 120) { level = max(level, 'warning'); reasons.push(`HR ${v.heartRate}`); }

  if (v.bodyTemp >= 40) { level = 'critical'; reasons.push(`Temp ${v.bodyTemp.toFixed(1)}°C`); }
  else if (v.bodyTemp >= 38.5) { level = max(level, 'warning'); reasons.push(`Temp ${v.bodyTemp.toFixed(1)}°C`); }

  if (v.fallDetected) { level = 'critical'; reasons.push('Fall'); }

  return { level, reasons };
}

function max(a: 'normal' | 'warning' | 'critical', b: 'normal' | 'warning' | 'critical') {
  const order = { normal: 0, warning: 1, critical: 2 } as const;
  return order[b] > order[a] ? b : a;
}
