"use client";
import { useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, HeartPulse, Thermometer, Activity, ShieldAlert } from 'lucide-react';

type Patient = {
  id: string;
  full_name: string;
  lat: number | null;
  lng: number | null;
  emergency: boolean;
  last_updated: string | null;
  heart_rate: number | null;
  spo2: number | null;
  body_temp: number | null;
  room_temp: number | null;
  room_humidity: number | null;
  ecg: number | null;
  fall_detected: boolean;
  status: 'normal' | 'warning' | 'critical' | string;
};

function StatusPill({ status }: { status: Patient['status'] }) {
  const cls =
    status === 'critical'
      ? 'bg-red-500/15 text-red-500 ring-1 ring-red-500/30'
      : status === 'warning'
      ? 'bg-amber-500/15 text-amber-500 ring-1 ring-amber-500/30'
      : 'bg-emerald-500/15 text-emerald-500 ring-1 ring-emerald-500/30';
  const label = status === 'critical' ? 'CRITICAL' : status === 'warning' ? 'WARNING' : 'STABLE';
  return <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold tracking-wide ${cls}`}>{label}</span>;
}

function RedWaveDot({ active }: { active: boolean }) {
  return (
    <span className="relative inline-flex h-2.5 w-2.5">
      {active && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-60"></span>}
      <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${active ? 'bg-red-500' : 'bg-emerald-500'}`}></span>
    </span>
  );
}

export default function PatientsPage() {
  const [loading, setLoading] = useState(true);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'normal' | 'warning' | 'critical'>('all');

  async function load() {
    try {
      const res = await fetch('/api/patients', { cache: 'no-store' });
      const json = await res.json();
      setPatients(json.patients || []);
    } catch {
      setPatients([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return patients.filter((p) => {
      const matchesQ = !q || p.full_name.toLowerCase().includes(q);
      const matchesF = filter === 'all' ? true : p.status === filter;
      return matchesQ && matchesF;
    });
  }, [patients, query, filter]);

  return (
    <main className="min-h-[calc(100vh-60px)] pt-16">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold">Patients</h1>
            <p className="text-sm text-muted-foreground">Live status and latest vitals. No map here — focused details view.</p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Input
              placeholder="Search patients…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full sm:w-[260px]"
            />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="h-9 rounded-md border bg-background px-2.5 text-sm"
            >
              <option value="all">All</option>
              <option value="normal">Stable</option>
              <option value="warning">Warning</option>
              <option value="critical">Critical</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-5 w-16" />
                  </div>
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-4 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((p) => (
              <Card key={p.id} className="overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <RedWaveDot active={p.status === 'critical' || p.emergency || p.fall_detected} />
                      <span className="truncate max-w-[200px] sm:max-w-[260px]">{p.full_name}</span>
                    </CardTitle>
                    <StatusPill status={p.status} />
                  </div>
                </CardHeader>
                <CardContent className="pt-2">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Badge variant="secondary" className="gap-1">
                      <HeartPulse className="h-4 w-4" />
                      <span>{p.heart_rate ?? '—'} bpm</span>
                    </Badge>
                    <Badge variant="secondary" className="gap-1">
                      <Activity className="h-4 w-4" />
                      <span>{p.spo2 ?? '—'}% SpO₂</span>
                    </Badge>
                    <Badge variant="secondary" className="gap-1">
                      <Thermometer className="h-4 w-4" />
                      <span>{p.body_temp ?? '—'}°C</span>
                    </Badge>
                    {(p.emergency || p.fall_detected) && (
                      <Badge className="gap-1 bg-red-500/15 text-red-600 ring-1 ring-red-500/30">
                        <AlertTriangle className="h-4 w-4" />
                        <span>{p.fall_detected ? 'Fall detected' : 'Emergency'}</span>
                      </Badge>
                    )}
                  </div>
                  <div className="mt-3 text-xs text-muted-foreground">
                    Last updated {p.last_updated ? new Date(p.last_updated).toLocaleString() : '—'}
                  </div>
                </CardContent>
              </Card>
            ))}
            {filtered.length === 0 && (
              <div className="col-span-full text-center text-sm text-muted-foreground py-10">No patients match your filter.</div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
