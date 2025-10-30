export type Vitals = {
  heartRate: number;
  spo2: number;
  bodyTemp: number;
  roomTemp: number;
  roomHumidity: number;
  ecg: number;
  fallDetected: boolean;
};

export type Patient = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  vitals: Vitals;
  lastUpdated: number; // epoch ms
  emergency: boolean;
};

export type PatientWithStatus = Patient & {
  status: 'normal' | 'warning' | 'critical';
  reasons?: string[];
};

export type VitalsPoint = { ts: number } & Vitals;
