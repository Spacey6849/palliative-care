import { Patient, PatientWithStatus, Vitals, VitalsPoint } from './patient-types';
import { classify } from './patient-status';

class PatientStore {
  private patients = new Map<string, Patient>();
  private history = new Map<string, VitalsPoint[]>();
  private simulationStarted = false;

  constructor() {
    const now = Date.now();
    const seed: Patient[] = [
      { id: 'p1', name: 'Aisha Kamau', lat: -1.2921, lng: 36.8219, vitals: { heartRate: 78, spo2: 96, bodyTemp: 36.9, roomTemp: 24, roomHumidity: 55, ecg: 0.12, fallDetected: false }, lastUpdated: now, emergency: false },
      { id: 'p2', name: 'John Otieno', lat: 0.3476, lng: 32.5825, vitals: { heartRate: 62, spo2: 94, bodyTemp: 37.2, roomTemp: 26.5, roomHumidity: 60, ecg: 0.08, fallDetected: false }, lastUpdated: now, emergency: false },
      { id: 'p3', name: 'Mary Njeri', lat: 6.5244, lng: 3.3792, vitals: { heartRate: 88, spo2: 98, bodyTemp: 36.7, roomTemp: 25.3, roomHumidity: 58, ecg: 0.11, fallDetected: false }, lastUpdated: now, emergency: false },
    ];
    seed.forEach(p => { this.patients.set(p.id, p); this.appendHistory(p.id, p.vitals, now); });
  }

  private appendHistory(id: string, v: Vitals, ts: number) {
    const arr = this.history.get(id) ?? [];
    arr.push({ ts, ...v });
    if (arr.length > 500) arr.shift();
    this.history.set(id, arr);
  }

  startSimulation() {
    if (this.simulationStarted) return;
    this.simulationStarted = true;
    const jitter = (v: number, d: number, min?: number, max?: number) => {
      let r = v + (Math.random() * 2 - 1) * d;
      if (min !== undefined) r = Math.max(min, r);
      if (max !== undefined) r = Math.min(max, r);
      return r;
    };
    setInterval(() => {
      this.patients.forEach((p) => {
        const v = p.vitals;
        const next: Vitals = {
          heartRate: Math.round(jitter(v.heartRate, 5, 35, 160)),
          spo2: Math.round(jitter(v.spo2, 1.5, 80, 100)),
          bodyTemp: parseFloat(jitter(v.bodyTemp, 0.2, 35, 41.5).toFixed(1)),
          roomTemp: parseFloat(jitter(v.roomTemp, 0.3, 15, 35).toFixed(1)),
          roomHumidity: Math.round(jitter(v.roomHumidity, 2, 20, 90)),
          ecg: parseFloat(jitter(v.ecg, 0.02, 0, 1).toFixed(2)),
          fallDetected: Math.random() < 0.02 ? true : false,
        };
        p.vitals = next;
        p.lastUpdated = Date.now();
        if (p.vitals.fallDetected && Math.random() < 0.5) p.vitals.fallDetected = false;
        if (p.emergency && Math.random() < 0.1) p.emergency = false;
        this.patients.set(p.id, { ...p });
        this.appendHistory(p.id, next, p.lastUpdated);
      });
    }, 8000);
  }

  list(): PatientWithStatus[] {
    return Array.from(this.patients.values()).map(p => {
      const { level, reasons } = classify(p.vitals);
      const isCritical = p.emergency || p.vitals.fallDetected || level === 'critical';
      return { ...p, status: isCritical ? 'critical' : level, reasons };
    });
  }

  historyFor(id: string): VitalsPoint[] {
    return this.history.get(id) ?? [];
  }

  upsertTelemetry(id: string, partial: { vitals?: Partial<Vitals>; lat?: number; lng?: number; name?: string }) {
    const existing = this.patients.get(id);
    const now = Date.now();
    if (!existing) {
      const p: Patient = {
        id,
        name: partial.name ?? `Patient ${id}`,
        lat: partial.lat ?? 0,
        lng: partial.lng ?? 0,
        vitals: {
          heartRate: partial.vitals?.heartRate ?? 70,
          spo2: partial.vitals?.spo2 ?? 97,
          bodyTemp: partial.vitals?.bodyTemp ?? 36.8,
          roomTemp: partial.vitals?.roomTemp ?? 25,
          roomHumidity: partial.vitals?.roomHumidity ?? 50,
          ecg: partial.vitals?.ecg ?? 0.1,
          fallDetected: partial.vitals?.fallDetected ?? false,
        },
        lastUpdated: now,
        emergency: false,
      };
      this.patients.set(id, p);
      this.appendHistory(id, p.vitals, now);
      return p;
    }
    const updated: Patient = { ...existing, ...partial, vitals: { ...existing.vitals, ...(partial.vitals ?? {}) }, lastUpdated: now };
    this.patients.set(id, updated);
    this.appendHistory(id, updated.vitals, now);
    return updated;
  }

  setEmergency(id: string, emergency: boolean) {
    const p = this.patients.get(id);
    if (!p) return null;
    p.emergency = emergency;
    p.lastUpdated = Date.now();
    this.patients.set(id, { ...p });
    return p;
  }
}

export const patientStore = new PatientStore();
if (process.env.NODE_ENV !== 'production') patientStore.startSimulation();
