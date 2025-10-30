'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
// Markdown rendering (safe require handling of default export)
let ReactMarkdown: any;
let remarkGfm: any;
try {
  // Some bundlers expose default, others the function itself
  const md = require('react-markdown');
  ReactMarkdown = md.default || md;
  const gfm = require('remark-gfm');
  remarkGfm = gfm.default || gfm;
} catch {
  // Fallback no-op renderer if lib not loaded
  const FallbackMD = (props: any) => <>{props.children}</>;
  FallbackMD.displayName = 'FallbackMarkdown';
  ReactMarkdown = FallbackMD;
  remarkGfm = () => {};
}
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Search, Gauge, Heart, Activity, Droplets, Thermometer } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MetricCard } from './metric-card';
// Bin chart component removed with wells cleanup
import { ThemeToggle } from './theme-toggle';
import { useUser } from '@/components/user-context';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts';
import { getSupabase } from '@/lib/supabase/client';

export interface PatientData {
  id: string;
  full_name: string;
  lat: number;
  lng: number;
  emergency: boolean;
  last_updated: string;
  heart_rate?: number;
  spo2?: number;
  body_temp?: number;
  room_temp?: number;
  room_humidity?: number;
  ecg?: string;
  fall_detected: boolean;
  status: 'normal' | 'warning' | 'critical' | 'emergency';
}

interface SidebarProps {
  patients: PatientData[];
  selectedPatient?: PatientData;
  onPatientSelect: (patient: PatientData) => void;
  onSearchHighlightChange?: (ids: string[]) => void; // emit matching patient ids for map highlighting
}

export function Sidebar({ patients, selectedPatient, onPatientSelect, onSearchHighlightChange }: SidebarProps) {
  // Start collapsed by default (mobile); expand on desktop after mount
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeChart, setActiveChart] = useState<'heart_rate' | 'spo2' | 'body_temp' | 'room_temp'>('heart_rate');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [trendData, setTrendData] = useState<{ time: string; value: number }[]>([]);
  const [trendLoading, setTrendLoading] = useState(false);
  const { role } = useUser();

  const filteredPatients = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return patients.filter(patient => {
      if (q && !patient.full_name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [patients, searchQuery]);

  // Emit highlight ids for map markers
  useEffect(() => {
    if (!onSearchHighlightChange) return;
    // Only compute ids when query changes (filteredPatients already memoized)
    const ids = searchQuery ? filteredPatients.map(p=>p.id) : [];
    onSearchHighlightChange(ids);
  }, [searchQuery, filteredPatients, onSearchHighlightChange]);

  // Select helper
  const selectPatient = (patient: PatientData) => {
    onPatientSelect(patient);
    setSearchQuery(patient.full_name);
    setShowSuggestions(false);
  };

  // Load today's vitals trend for the selected patient from patient_vitals
  useEffect(() => {
    (async () => {
      if (!selectedPatient) { setTrendData([]); return; }
      setTrendLoading(true);
      const sb = getSupabase();
      try {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const startIso = start.toISOString();

        const { data } = await sb
          .from('patient_vitals')
          .select('recorded_at, heart_rate, spo2, body_temp')
          .eq('patient_id', selectedPatient.id)
          .gte('recorded_at', startIso)
          .order('recorded_at', { ascending: true });

        const rows = data || [];
        const points = rows
          .filter(r => {
            const val = activeChart === 'heart_rate' ? r.heart_rate : 
                       activeChart === 'spo2' ? r.spo2 : 
                       activeChart === 'body_temp' ? r.body_temp : null;
            return val !== null && val !== undefined && isFinite(Number(val));
          })
          .map(r => {
            const d = new Date(r.recorded_at);
            const label = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const val = activeChart === 'heart_rate' ? Number(r.heart_rate) : 
                       activeChart === 'spo2' ? Number(r.spo2) : 
                       Number(r.body_temp);
            return { time: label, value: Math.round(val * 10) / 10 };
          });
        setTrendData(points);
      } catch {
        setTrendData([]);
      } finally {
        setTrendLoading(false);
      }
    })();
  }, [selectedPatient, activeChart]);

  const getMetricStatus = (value: number, type: 'heart_rate' | 'spo2' | 'body_temp' | 'room_temp') => {
    switch (type) {
      case 'heart_rate':
        if (value >= 60 && value <= 100) return 'good';
        if (value >= 50 && value <= 120) return 'warning';
        return 'critical';
      case 'spo2':
        if (value >= 95) return 'good';
        if (value >= 90) return 'warning';
        return 'critical';
      case 'body_temp':
        if (value >= 36.1 && value <= 37.2) return 'good';
        if (value >= 35.5 && value <= 38.0) return 'warning';
        return 'critical';
      case 'room_temp':
        if (value >= 18 && value <= 24) return 'good';
        if (value >= 15 && value <= 28) return 'warning';
        return 'critical';
      default:
        return 'good';
    }
  };

  const sidebarVariants = {
    expanded: {
      x: 0,
      opacity: 1,
      transition: { duration: 0.28, ease: [0.16, 1, 0.3, 1] }
    },
    collapsed: {
      x: -380,
      opacity: 0,
      transition: { duration: 0.25, ease: [0.4, 0, 0.2, 1] }
    }
  } as const;

  const contentVariants = {
    expanded: {
      opacity: 1,
      transition: { duration: 0.15, delay: 0.1 }
    },
    collapsed: {
      opacity: 0,
      transition: { duration: 0.1 }
    }
  };

  // Expand automatically on desktop screens after mount
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth >= 768) {
      setIsCollapsed(false);
    }
  }, []);

  return (
  <div className="h-full relative pl-0 pr-0 md:pl-2 md:pr-4">
      {/* Toggle Handle */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className={`flex group fixed md:absolute top-1/2 -translate-y-1/2
          ${isCollapsed ? 'left-0' : 'left-0 md:left-[360px]'}
          z-[1250] w-8 h-16 items-center justify-center rounded-l-none rounded-r-md bg-white/95 dark:bg-gray-900/90 border border-gray-300/70 dark:border-gray-700/70 shadow-lg hover:bg-white dark:hover:bg-gray-900 hover:shadow-xl transition-all duration-200`}
        aria-label={isCollapsed ? 'Open sidebar' : 'Close sidebar'}
        aria-expanded={!isCollapsed}
        title={isCollapsed ? 'Open sidebar' : 'Close sidebar'}
      >
        <motion.div animate={{ rotate: isCollapsed ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronLeft className="h-4 w-4 text-gray-800 dark:text-gray-100 group-hover:text-gray-900 dark:group-hover:text-white transition-colors" />
        </motion.div>
      </button>
      <motion.div
        className="h-full w-full md:w-[360px] pointer-events-auto fixed md:static inset-y-0 left-0 z-[1150] md:z-auto"
        variants={sidebarVariants}
        animate={isCollapsed ? 'collapsed' : 'expanded'}
        initial={false}
      >
    <div className="h-full bg-white/95 dark:bg-gray-950/80 supports-[backdrop-filter]:backdrop-blur-xl border-r md:border-gray-200/60 md:dark:border-gray-800/60 border-gray-200 dark:border-gray-800 shadow-xl md:rounded-r-2xl rounded-none flex flex-col">

        <AnimatePresence>
          {!isCollapsed && (
            <motion.div
              className="h-full flex flex-col p-6 pt-14 overflow-x-hidden"
              variants={contentVariants}
              initial="collapsed"
              animate="expanded"
              exit="collapsed"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-5">
                <h1 className="text-[20px] font-semibold tracking-tight text-gray-900 dark:text-white">Palliative Care Dashboard</h1>
                <ThemeToggle />
              </div>

              {/* Tabs */}
              <Tabs defaultValue="dashboard" className="flex-1 flex flex-col min-h-0">
                <TabsList className="grid w-full grid-cols-4 mb-4 bg-secondary/70 dark:bg-secondary/50 p-1 rounded-lg text-[11px] md:text-[13px]">
                  <TabsTrigger className="data-[state=active]:bg-background dark:data-[state=active]:bg-background rounded-md text-[13px]" value="dashboard">Dashboard</TabsTrigger>
                  <TabsTrigger className="data-[state=active]:bg-background dark:data-[state=active]:bg-background rounded-md text-[13px]" value="analytics">Analytics</TabsTrigger>
                  <TabsTrigger className="data-[state=active]:bg-background dark:data-[state=active]:bg-background rounded-md text-[13px]" value="route">Route</TabsTrigger>
                  <TabsTrigger className="data-[state=active]:bg-background dark:data-[state=active]:bg-background rounded-md text-[13px]" value="chat">AI Chatbot</TabsTrigger>
                </TabsList>

                {/* Search Bar */}
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search patients..."
                    value={searchQuery}
                    onFocus={()=> setShowSuggestions(true)}
                    onBlur={(e)=> {
                      // Delay closing to allow click
                      setTimeout(()=> setShowSuggestions(false), 120);
                    }}
                    onKeyDown={(e)=> {
                      if (e.key === 'Enter') {
                        if (filteredPatients.length === 1) {
                          selectPatient(filteredPatients[0]);
                        } else if (filteredPatients.length > 1) {
                          selectPatient(filteredPatients[0]);
                        }
                      }
                    }}
                    onChange={(e) => {setSearchQuery(e.target.value); setShowSuggestions(true);} }
                    className="pl-10 h-10 text-sm rounded-full border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-secondary/60 focus-visible:ring-0 focus:border-gray-300 dark:focus:border-gray-600"
                  />
                  {showSuggestions && searchQuery && filteredPatients.length > 0 && (
                    <div className="absolute left-0 right-0 mt-1 bg-white dark:bg-gray-900/95 border border-border/70 dark:border-border rounded-xl shadow-xl overflow-hidden z-40 animate-in fade-in-0 zoom-in-95">
                      <ul className="max-h-56 overflow-auto py-1 text-sm">
                        {filteredPatients.map(p => (
                          <li key={p.id}>
                            <button
                              type="button"
                              onMouseDown={(e)=> e.preventDefault()}
                              onClick={()=> selectPatient(p)}
                              className={`w-full text-left px-3 py-2 flex items-center justify-between hover:bg-muted/60 dark:hover:bg-muted/40 transition-colors ${selectedPatient?.id===p.id ? 'bg-primary/10 text-primary font-medium' : ''}`}
                            >
                              <span className="truncate pr-3">{p.full_name}</span>
                              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${p.emergency || p.status==='emergency'?'bg-red-400 animate-pulse': p.status==='critical'?'bg-red-400': p.status==='warning'?'bg-amber-400':'bg-emerald-400'}`}></span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <TabsContent value="dashboard" className="flex-1 overflow-auto space-y-4">
                  {/* Summary Metrics */}
                  {selectedPatient && (
                    <>
                      <Card className="bg-card/90 dark:bg-card/90 backdrop-blur-sm border border-gray-200/60 dark:border-gray-800/60 shadow-sm">
                        <CardHeader className="pb-1">
                          <CardTitle className="text-base font-semibold tracking-tight flex items-center gap-2">
                            <Heart className="h-4 w-4 text-red-500" />
                            {selectedPatient.full_name}
                          </CardTitle>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            Last updated: {new Date(selectedPatient.last_updated).toLocaleTimeString()}
                          </p>
                        </CardHeader>
                        <CardContent className="space-y-3 pt-2">
                          <div className="grid grid-cols-2 gap-2.5">
                            {selectedPatient.heart_rate != null && (
                              <MetricCard
                                label="Heart Rate"
                                value={String(selectedPatient.heart_rate)}
                                unit="bpm"
                                status={getMetricStatus(selectedPatient.heart_rate, 'heart_rate')}
                                icon={<Activity className="h-4 w-4" />}
                                onClick={() => setActiveChart('heart_rate')}
                                isActive={activeChart === 'heart_rate'}
                              />
                            )}
                            {selectedPatient.spo2 != null && (
                              <MetricCard
                                label="SpO₂"
                                value={String(selectedPatient.spo2)}
                                unit="%"
                                status={getMetricStatus(selectedPatient.spo2, 'spo2')}
                                icon={<Droplets className="h-4 w-4" />}
                                onClick={() => setActiveChart('spo2')}
                                isActive={activeChart === 'spo2'}
                              />
                            )}
                            {selectedPatient.body_temp != null && (
                              <MetricCard
                                label="Body Temp"
                                value={(Number(selectedPatient.body_temp)).toFixed(1)}
                                unit="°C"
                                status={getMetricStatus(selectedPatient.body_temp, 'body_temp')}
                                icon={<Thermometer className="h-4 w-4" />}
                                onClick={() => setActiveChart('body_temp')}
                                isActive={activeChart === 'body_temp'}
                              />
                            )}
                            {selectedPatient.room_temp != null && (
                              <MetricCard
                                label="Room Temp"
                                value={(Number(selectedPatient.room_temp)).toFixed(1)}
                                unit="°C"
                                status={getMetricStatus(selectedPatient.room_temp, 'room_temp')}
                                icon={<Thermometer className="h-4 w-4" />}
                                onClick={() => setActiveChart('room_temp')}
                                isActive={activeChart === 'room_temp'}
                              />
                            )}
                          </div>
                          {selectedPatient.fall_detected && (
                            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-2 text-sm text-red-600 dark:text-red-400 font-medium">
                              ⚠ Fall Detected!
                            </div>
                          )}
                        </CardContent>
                      </Card>
                      {/* Trend Section: Vitals today for selected patient */}
                      <Card className="bg-card/90 dark:bg-card/90 backdrop-blur-sm border border-gray-200/60 dark:border-gray-800/60 shadow-sm">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base font-semibold tracking-tight">Vital Signs Trend</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-1 pb-3">
                          {trendLoading ? (
                            <div className="text-xs text-gray-500 dark:text-gray-400">Loading today&#39;s vitals…</div>
                          ) : trendData.length ? (
                            <div className="h-40">
                              <ChartContainer config={{ value: { label: activeChart.replace('_', ' '), color: 'hsl(142 72% 29%)' } }}>
                                <ResponsiveContainer>
                                  <LineChart data={trendData} margin={{ left: 6, right: 6, top: 6, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                                    <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                                    <YAxis tick={{ fontSize: 10 }} />
                                    <Line type="monotone" dataKey="value" stroke="var(--color-value)" strokeWidth={2} dot={false} />
                                    <ChartTooltip content={<ChartTooltipContent />} />
                                    <ChartLegend content={<ChartLegendContent />} />
                                  </LineChart>
                                </ResponsiveContainer>
                              </ChartContainer>
                            </div>
                          ) : (
                            <div className="text-sm text-gray-600 dark:text-gray-400">No metrics for today.</div>
                          )}
                        </CardContent>
                      </Card>
                    </>
                  )}

                  {/* Patients List */}
                  <Card className="bg-card/90 dark:bg-card/90 backdrop-blur-sm border border-gray-200/60 dark:border-gray-800/60 shadow-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base font-semibold tracking-tight">Patients Overview</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-1.5 max-h-56 overflow-auto pr-1 custom-scrollbar">
                        {filteredPatients.map((patient) => (
                          <motion.div
                            key={patient.id}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                          >
                            <Button
                              variant={selectedPatient?.id === patient.id ? 'default' : 'ghost'}
                              className="w-full justify-start px-3 py-2 h-auto rounded-lg text-sm"
                              onClick={() => selectPatient(patient)}
                            >
                              <div className="flex items-center justify-between w-full gap-2">
                                <div className="text-left min-w-0">
                                  <p className="font-medium truncate leading-tight">{patient.full_name}</p>
                                  <p className="text-[11px] text-emerald-600 dark:text-emerald-300 leading-snug">
                                    {patient.heart_rate != null ? `HR: ${patient.heart_rate} bpm` : ''}
                                    {patient.spo2 != null ? ` • SpO₂: ${patient.spo2}%` : ''}
                                    {patient.body_temp != null ? ` • ${Number(patient.body_temp).toFixed(1)}°C` : ''}
                                  </p>
                                </div>
                                <div className={`w-3 h-3 rounded-full shrink-0 ${
                                  patient.emergency || patient.status === 'emergency' ? 'bg-red-500 animate-pulse' :
                                  patient.status === 'critical' ? 'bg-red-500' :
                                  patient.status === 'warning' ? 'bg-yellow-500' :
                                  'bg-green-500'
                                }`} />
                              </div>
                            </Button>
                          </motion.div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>                <TabsContent value="analytics" className="flex-1 overflow-auto space-y-4">
                      <Card className="bg-card/90 dark:bg-card/90 backdrop-blur-sm border border-gray-200/60 dark:border-gray-800/60 shadow-sm">
                      <CardHeader className="pb-3">
                      <CardTitle className="text-base font-semibold tracking-tight">Patient Analytics</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                          <p className="text-xl font-bold text-blue-600 dark:text-blue-400 leading-tight">
                            {patients.length}
                          </p>
                              <p className="text-sm text-gray-600 dark:text-gray-400">Total Patients</p>
                        </div>
                        <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                          <p className="text-xl font-bold text-green-600 dark:text-green-400 leading-tight">
                            {patients.filter((p) => p.status === 'normal').length}
                          </p>
                              <p className="text-sm text-gray-600 dark:text-gray-400">Stable</p>
                        </div>
                        <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                          <p className="text-xl font-bold text-yellow-600 dark:text-yellow-400 leading-tight">
                            {patients.filter((p) => p.status === 'warning' || p.status === 'critical').length}
                          </p>
                              <p className="text-sm text-gray-600 dark:text-gray-400">Needs Attention</p>
                        </div>
                        <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                          <p className="text-xl font-bold text-red-600 dark:text-red-400 leading-tight">
                            {patients.filter((p) => p.emergency || p.status === 'emergency').length}
                          </p>
                              <p className="text-sm text-gray-600 dark:text-gray-400">Emergency</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Route Planner Tab */}
                <TabsContent value="route" className="flex-1 overflow-auto space-y-4">
                  <RoutePlanner patients={patients} />
                </TabsContent>

                {/* AI Chatbot Tab */}
                <TabsContent
                  value="chat"
                  className="flex-1 min-h-0 p-0 data-[state=active]:flex data-[state=active]:flex-col"
                >
                  <AIChat />
                </TabsContent>
              </Tabs>
            </motion.div>
          )}
        </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}

// --- Helper Components Added Below ---
// (useEffect already imported at top)

interface RoutePlannerProps { patients: PatientData[] }

function RoutePlanner({ patients }: RoutePlannerProps) {
  const [position, setPosition] = useState<GeolocationPosition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [optLink, setOptLink] = useState<string | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Geolocation not supported');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setPosition(pos),
      (err) => setError(err.message),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);

  const haversine = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // km
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const distances = position
    ? patients.map(p => ({
        patient: p,
        distanceKm: haversine(position.coords.latitude, position.coords.longitude, p.lat, p.lng)
      }))
    : [];

  // Simple nearest-neighbor route (placeholder for full TSP) starting at user position
  const routeOrder = () => {
    if (!position || patients.length === 0) return [] as { name: string; distanceFromPrev: number }[];
    const remaining = [...patients];
    let currentLat = position.coords.latitude;
    let currentLng = position.coords.longitude;
    const order: { name: string; distanceFromPrev: number }[] = [];
    while (remaining.length) {
      let bestIdx = 0;
      let bestDist = Infinity;
      for (let i = 0; i < remaining.length; i++) {
        const d = haversine(currentLat, currentLng, remaining[i].lat, remaining[i].lng);
        if (d < bestDist) { bestDist = d; bestIdx = i; }
      }
      const next = remaining.splice(bestIdx, 1)[0];
      order.push({ name: next.full_name, distanceFromPrev: bestDist });
      currentLat = next.lat; currentLng = next.lng;
    }
    return order;
  };

  const order = routeOrder();
  const totalDistance = order.reduce((sum, o) => sum + o.distanceFromPrev, 0);

  useEffect(() => {
    if (!position || order.length === 0) { setOptLink(null); return; }
    // Build Google Maps directions URL: origin -> waypoints -> destination (last)
    // If only one patient: origin user position to that patient.
    const origin = `${position.coords.latitude},${position.coords.longitude}`;
    const coordsList: string[] = [];
    order.forEach(o => {
      const p = patients.find(pt => pt.full_name === o.name);
      if (p) {
        coordsList.push(`${p.lat},${p.lng}`);
      }
    });
    if (!coordsList.length) { setOptLink(null); return; }
    const destination = coordsList[coordsList.length - 1];
    const waypoints = coordsList.slice(0, -1).join('|');
    const base = 'https://www.google.com/maps/dir/?api=1';
    const url = waypoints
      ? `${base}&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&waypoints=${encodeURIComponent(waypoints)}&travelmode=driving`
      : `${base}&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&travelmode=driving`;
    setOptLink(url);
  }, [order, position, patients]);

  const estimatedMinutes = (totalDistance / 40) * 60; // crude avg 40km/h

  return (
  <Card className="bg-card/90 dark:bg-card/90 backdrop-blur-sm border border-gray-200/60 dark:border-gray-800/60 shadow-sm">
      <CardHeader className="pb-2">
  <CardTitle className="text-base font-semibold tracking-tight">Route</CardTitle>
        <p className="text-xs text-gray-500 dark:text-gray-400">Visit patients in optimal order. Open in Google Maps for navigation.</p>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {!position && !error && (
          <div className="text-gray-500 dark:text-gray-400">Requesting location permission...</div>
        )}
        {error && <div className="text-red-600 text-xs">{error}</div>}
        {position && (
          <div className="text-xs text-gray-600 dark:text-gray-400">
            Your Position: {position.coords.latitude.toFixed(5)}, {position.coords.longitude.toFixed(5)}
          </div>
        )}
        {position && distances.length > 0 && (
          <div className="space-y-1">
            {distances.map(d => (
              <div key={d.patient.id} className="flex items-center justify-between rounded-md px-2 py-1 bg-gray-100/70 dark:bg-gray-900/40">
                <span className="font-medium text-gray-800 dark:text-gray-200">{d.patient.full_name}</span>
                <span className="text-xs text-gray-600 dark:text-gray-400">{d.distanceKm.toFixed(2)} km</span>
              </div>
            ))}
          </div>
        )}
        {order.length > 0 && (
          <div className="mt-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Suggested Order</p>
            <ol className="space-y-1 list-decimal list-inside">
              {order.map((o, idx) => (
                <li key={idx} className="text-gray-700 dark:text-gray-300">
                  {o.name} <span className="text-xs text-gray-500 dark:text-gray-400">(+{o.distanceFromPrev.toFixed(2)} km)</span>
                </li>
              ))}
            </ol>
            <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">Total Distance: {totalDistance.toFixed(2)} km · Est Time: {estimatedMinutes.toFixed(0)} min</p>
            {optLink && (
              <a href={optLink} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-2 text-[11px] px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow focus:outline-none focus:ring-2 focus:ring-emerald-400/50">
                Open in Google Maps
              </a>
            )}
          </div>
        )}
        {position && patients.length <= 1 && (
          <>
            <div className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">Add more patients to compute multi-stop routes.</div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

interface ChatMessage { role: 'user' | 'assistant'; content: string }

function AIChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: 'Hi! I\'m your Palliative Care assistant. Ask me about patient status, vitals, or get a quick summary.' }
  ]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [loadedHistory, setLoadedHistory] = useState(false);

  // Load history from Supabase via API (GET /api/chat)
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/chat?limit=100');
        if (res.ok) {
          const json = await res.json();
            if (Array.isArray(json.messages) && json.messages.length) {
              // Map and fallback if roles unexpected
              const hist: ChatMessage[] = json.messages.map((m: any) => ({
                role: m.role === 'user' ? 'user' : 'assistant',
                content: m.content || ''
              }));
              setMessages(hist);
            }
        }
      } catch (e) {
        // ignore fetch errors (offline etc.)
      } finally {
        setLoadedHistory(true);
      }
    })();
  }, []);

  // Auto-scroll to bottom on new messages / streaming updates
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, streaming]);

  const sendMessage = async () => {
    if (!input.trim() || streaming) return;
    const userMessage: ChatMessage = { role: 'user', content: input.trim() };
    const base = [...messages, userMessage];
    // Optimistically add placeholder assistant message for streaming
    setMessages([...base, { role: 'assistant', content: '' }]);
    setInput('');
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: base.slice(-10), stream: false })
      });
      const contentType = res.headers.get('content-type') || '';
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text.slice(0, 300));
      }
      if (contentType.includes('text/html')) {
        const html = await res.text();
        throw new Error('Server returned HTML (likely build config / dynamic route issue).');
      }
      // Non-streaming mode: get the full response text
      const assistantText = await res.text();
      setMessages(prev => {
        const copy = [...prev];
        // Update the last message (assistant placeholder) with the full response
        copy[copy.length - 1] = { role: 'assistant', content: assistantText };
        return copy;
      });
    } catch (e: any) {
      if (e.name === 'AbortError') {
        setMessages(prev => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: 'assistant', content: (copy.at(-1)?.content || '') + ' [stopped]' };
          return copy;
        });
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Error: ' + (e.message || 'unknown') }]);
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  };

  const stopStreaming = () => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
  };

  return (
  <Card className="bg-card/90 dark:bg-card/90 backdrop-blur-sm border border-gray-200/60 dark:border-gray-800/60 shadow-sm flex flex-col flex-1 min-h-0 h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold tracking-tight">AI Chatbot</CardTitle>
        <p className="text-xs text-gray-500 dark:text-gray-400">Gemini powered assistant.</p>
      </CardHeader>
  <CardContent className="flex-1 flex flex-col min-h-0 p-4">
        <div ref={scrollRef} className="flex-1 overflow-y-auto pr-1 space-y-3 aichat-scroll-visible min-h-0 pb-24">
          {!loadedHistory && (
            <div className="text-xs text-gray-500 dark:text-gray-400">Loading history...</div>
          )}
          {messages.map((m, i) => {
            const isAssistant = m.role === 'assistant';
            return (
              <div key={i} className={`group rounded-xl px-3 py-2.5 text-sm leading-relaxed max-w-[85%] whitespace-pre-wrap break-words shadow-sm transition-colors ${!isAssistant ? 'ml-auto bg-primary text-primary-foreground hover:brightness-110' : 'bg-muted/70 dark:bg-muted/60 text-gray-800 dark:text-gray-200 hover:bg-muted dark:hover:bg-muted/80'}`}>
                {isAssistant ? (
                  <div className="prose prose-xs dark:prose-invert max-w-none prose-p:my-2 prose-pre:bg-gray-200 dark:prose-pre:bg-gray-800 prose-code:bg-gray-200 dark:prose-code:bg-gray-800 prose-code:text-gray-900 dark:prose-code:text-gray-100 prose-a:text-blue-600 dark:prose-a:text-blue-400">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {m.content || (streaming && i === messages.length - 1 ? '▌' : '')}
                    </ReactMarkdown>
                  </div>
                ) : (m.content || (streaming && i === messages.length - 1 ? '▌' : ''))}
              </div>
            );
          })}
          {streaming && (
            <div className="text-[11px] tracking-wide text-gray-500 dark:text-gray-400 animate-pulse">Streaming response...</div>
          )}
        </div>
  <div className="flex items-center gap-2 pt-2 border-t border-transparent dark:border-transparent mt-0 bg-transparent dark:bg-transparent rounded-none">
          <Input
            placeholder={streaming ? 'Streaming... press Stop' : 'Ask about fill %, status, location...'}
            value={input}
            disabled={streaming}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            className="h-10 text-sm rounded-full bg-muted/40 dark:bg-muted/30 border border-border dark:border-gray-700 focus-visible:ring-0 disabled:opacity-60 flex-1 backdrop-blur-sm"
          />
          {!streaming && (
            <Button onClick={sendMessage} disabled={!input.trim()} className="rounded-full h-10 px-5 text-sm font-medium shadow-sm">Send</Button>
          )}
          {streaming && (
            <Button variant="destructive" onClick={stopStreaming} className="rounded-full h-10 px-5 text-sm font-medium">Stop</Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}