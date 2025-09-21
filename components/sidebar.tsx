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
import { ChevronLeft, Search, Gauge } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BinData } from '@/lib/bin-data';
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

interface SidebarProps {
  bins: BinData[];
  selectedBin?: BinData;
  onBinSelect: (bin: BinData) => void;
  onSearchHighlightChange?: (ids: string[]) => void; // emit matching bin ids for map highlighting
}

export function Sidebar({ bins, selectedBin, onBinSelect, onSearchHighlightChange }: SidebarProps) {
  // Start collapsed by default (mobile); expand on desktop after mount
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeChart, setActiveChart] = useState<'ph' | 'tds' | 'temperature' | 'waterLevel'>('ph');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [trendData, setTrendData] = useState<{ time: string; fill: number }[]>([]);
  const [trendLoading, setTrendLoading] = useState(false);
  const [selectedType, setSelectedType] = useState<'all' | 'private' | 'public'>('all');
  const { role } = useUser();
  const [reportOpen, setReportOpen] = useState(false);
  const [reportBin, setReportBin] = useState<{ id: string; name: string; fill?: number; is_open?: boolean } | null>(null);
  const [reportNote, setReportNote] = useState('');

  const filteredBins = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return bins.filter(bin => {
      if (q && !bin.name.toLowerCase().includes(q)) return false;
      if (selectedType !== 'all') {
        const bt = (bin.bin_type || '').toString().toLowerCase();
        if (bt !== selectedType) return false;
      }
      return true;
    });
  }, [bins, searchQuery, selectedType]);

  // Emit highlight ids for map markers
  useEffect(() => {
    if (!onSearchHighlightChange) return;
    // Only compute ids when query changes (filteredBins already memoized)
    const ids = searchQuery ? filteredBins.map(b=>b.id) : [];
    onSearchHighlightChange(ids);
  }, [searchQuery, filteredBins, onSearchHighlightChange]);

  // Select helper
  const selectBin = (bin: BinData) => {
    onBinSelect(bin);
    setSearchQuery(bin.name);
    setShowSuggestions(false);
  };

  // Auto email report for thresholds (admin only). Use simple once-per-day gating via localStorage
  useEffect(() => {
    if (role !== 'admin' || !selectedBin) return;
    const fill = typeof selectedBin.fill_pct === 'number' ? Math.round(selectedBin.fill_pct) : null;
    if (fill == null) return;
    const today = new Date().toISOString().slice(0, 10);
    const id = selectedBin.id;
    const key = (thr: number) => `bl_email_${id}_${thr}_${today}`;
    const send = async (thr: number) => {
      try {
        const res = await fetch(`/api/bins/${id}/send-report`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: 'auto', fill_pct: fill })
        });
        if (res.ok) localStorage.setItem(key(thr), '1');
      } catch {}
    };
    if (fill >= 100 && !localStorage.getItem(key(100))) {
      send(100);
    } else if (fill >= 70 && !localStorage.getItem(key(70))) {
      send(70);
    }
  }, [role, selectedBin]);

  // Load today's fill trend for the selected bin from bin_metrics
  useEffect(() => {
    (async () => {
      if (!selectedBin) { setTrendData([]); return; }
      setTrendLoading(true);
      const sb = getSupabase();
      try {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const startIso = start.toISOString();

        // First try by bin_id
        let rows: any[] = [];
        if (selectedBin.id) {
          const { data } = await sb
            .from('bin_metrics')
            .select('recorded_at, fill_pct, is_open')
            .eq('bin_id', selectedBin.id)
            .gte('recorded_at', startIso)
            .order('recorded_at', { ascending: true });
          rows = data || [];
        }
        // Fallback by bin_name if needed
        if ((!rows || rows.length === 0) && selectedBin.name) {
          const { data } = await sb
            .from('bin_metrics')
            .select('recorded_at, fill_pct, is_open')
            .eq('bin_name', selectedBin.name)
            .gte('recorded_at', startIso)
            .order('recorded_at', { ascending: true });
          rows = data || [];
        }

        const points = (rows || [])
          .filter(r => typeof r.fill_pct === 'number' && isFinite(Number(r.fill_pct)))
          .map(r => {
            const d = new Date(r.recorded_at);
            const label = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const v = Math.max(0, Math.min(100, Math.round(Number(r.fill_pct))));
            return { time: label, fill: v };
          });
        setTrendData(points);
      } catch {
        setTrendData([]);
      } finally {
        setTrendLoading(false);
      }
    })();
  }, [selectedBin]);

  const getMetricStatus = (value: number, type: 'ph' | 'tds' | 'temperature' | 'waterLevel') => {
    switch (type) {
      case 'ph':
        if (value >= 6.5 && value <= 8.5) return 'good';
        if (value >= 6.0 && value <= 9.0) return 'warning';
        return 'critical';
      case 'tds':
        if (value <= 300) return 'good';
        if (value <= 500) return 'warning';
        return 'critical';
      case 'temperature':
        if (value >= 15 && value <= 25) return 'good';
        if (value >= 10 && value <= 30) return 'warning';
        return 'critical';
      case 'waterLevel':
        if (value >= 40) return 'good';
        if (value >= 30) return 'warning';
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
                <h1 className="text-[20px] font-semibold tracking-tight text-gray-900 dark:text-white">Bin Monitor</h1>
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

                {/* Admin filter for bin type */}
                {role === 'admin' && (
                  <div className="mb-3 flex gap-2">
                    <Button size="sm" variant={selectedType==='all' ? 'default' : 'outline'} onClick={() => setSelectedType('all')}>All</Button>
                    <Button size="sm" variant={selectedType==='private' ? 'default' : 'outline'} onClick={() => setSelectedType('private')}>Private</Button>
                    <Button size="sm" variant={selectedType==='public' ? 'default' : 'outline'} onClick={() => setSelectedType('public')}>Public</Button>
                  </div>
                )}

                {/* Search Bar */}
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search bins..."
                    value={searchQuery}
                    onFocus={()=> setShowSuggestions(true)}
                    onBlur={(e)=> {
                      // Delay closing to allow click
                      setTimeout(()=> setShowSuggestions(false), 120);
                    }}
                    onKeyDown={(e)=> {
                      if (e.key === 'Enter') {
                        if (filteredBins.length === 1) {
                          selectBin(filteredBins[0]);
                        } else if (filteredBins.length > 1) {
                          selectBin(filteredBins[0]);
                        }
                      }
                    }}
                    onChange={(e) => {setSearchQuery(e.target.value); setShowSuggestions(true);} }
                    className="pl-10 h-10 text-sm rounded-full border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-secondary/60 focus-visible:ring-0 focus:border-gray-300 dark:focus:border-gray-600"
                  />
                  {showSuggestions && searchQuery && filteredBins.length > 0 && (
                    <div className="absolute left-0 right-0 mt-1 bg-white dark:bg-gray-900/95 border border-border/70 dark:border-border rounded-xl shadow-xl overflow-hidden z-40 animate-in fade-in-0 zoom-in-95">
                      <ul className="max-h-56 overflow-auto py-1 text-sm">
                        {filteredBins.map(w => (
                          <li key={w.id}>
                            <button
                              type="button"
                              onMouseDown={(e)=> e.preventDefault()}
                              onClick={()=> selectBin(w)}
                              className={`w-full text-left px-3 py-2 flex items-center justify-between hover:bg-muted/60 dark:hover:bg-muted/40 transition-colors ${selectedBin?.id===w.id ? 'bg-primary/10 text-primary font-medium' : ''}`}
                            >
                              <span className="truncate pr-3">{w.name}</span>
                              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${w.status==='active'?'bg-emerald-400': w.status==='warning'?'bg-amber-400': w.status==='critical'?'bg-red-400':'bg-gray-400'}`}></span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <TabsContent value="dashboard" className="flex-1 overflow-auto space-y-4">
                  {/* Summary Metrics */}
                  {selectedBin && (
                    <>
                      <Card className="bg-card/90 dark:bg-card/90 backdrop-blur-sm border border-gray-200/60 dark:border-gray-800/60 shadow-sm">
                        <CardHeader className="pb-1">
                          <CardTitle className="text-base font-semibold tracking-tight">{selectedBin.name}</CardTitle>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            Last updated: {(selectedBin.updated_at ?? selectedBin.data.lastUpdated).toLocaleTimeString()}
                          </p>
                        </CardHeader>
                        <CardContent className="space-y-3 pt-2">
                          <div className="grid grid-cols-2 gap-2.5">
                            {(() => {
                              // Prefer real fill_pct; fallback to derived tds mapping
                              const pct = typeof selectedBin.fill_pct === 'number'
                                ? Math.max(0, Math.min(100, Math.round(selectedBin.fill_pct)))
                                : (() => { const tds = Number(selectedBin.data?.tds ?? NaN); return isFinite(tds) ? Math.max(0, Math.min(100, Math.round(((tds - 200) / 600) * 100))) : 0; })();
                              return (
                                <MetricCard
                                  label="Bin Level"
                                  value={pct.toString()}
                                  unit="%"
                                  status={pct < 70 ? 'good' : pct < 90 ? 'warning' : 'critical'}
                                  icon={<Gauge className="h-4 w-4" />}
                                  onClick={() => setActiveChart('tds')}
                                  isActive={activeChart === 'tds'}
                                />
                              );
                            })()}
                            {(() => {
                              const isOffline = selectedBin.status === 'offline';
                              const isOpen = typeof selectedBin.is_open === 'boolean' ? selectedBin.is_open : (selectedBin.status !== 'active');
                              const value = isOffline ? 'Offline' : (isOpen ? 'Open' : 'Closed');
                              const s = isOffline ? 'warning' : (isOpen ? 'critical' : 'good');
                              return (
                                <MetricCard
                                  label="Status"
                                  value={value}
                                  unit=""
                                  status={s as any}
                                  icon={<Gauge className="h-4 w-4" />}
                                  onClick={() => setActiveChart('tds')}
                                  isActive={false}
                                  align="center"
                                />
                              );
                            })()}
                          </div>
                        </CardContent>
                      </Card>
                      {/* Trend Section: Fill % today for selected bin */}
                      <Card className="bg-card/90 dark:bg-card/90 backdrop-blur-sm border border-gray-200/60 dark:border-gray-800/60 shadow-sm">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base font-semibold tracking-tight">Trends</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-1 pb-3">
                          {trendLoading ? (
                            <div className="text-xs text-gray-500 dark:text-gray-400">Loading today&#39;s fill trend…</div>
                          ) : trendData.length ? (
                            <div className="h-40">
                              <ChartContainer config={{ fill: { label: 'Fill %', color: 'hsl(142 72% 29%)' } }}>
                                <ResponsiveContainer>
                                  <LineChart data={trendData} margin={{ left: 6, right: 6, top: 6, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                                    <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                                    <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                                    <Line type="monotone" dataKey="fill" stroke="var(--color-fill)" strokeWidth={2} dot={false} />
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

                  {/* Bins List */}
                  <Card className="bg-card/90 dark:bg-card/90 backdrop-blur-sm border border-gray-200/60 dark:border-gray-800/60 shadow-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base font-semibold tracking-tight">Bins Overview</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-1.5 max-h-56 overflow-auto pr-1 custom-scrollbar">
                        {filteredBins.map((bin) => (
                          <motion.div
                            key={bin.id}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                          >
                            <Button
                              variant={selectedBin?.id === bin.id ? 'default' : 'ghost'}
                              className="w-full justify-start px-3 py-2 h-auto rounded-lg text-sm"
                              onClick={() => selectBin(bin)}
                            >
                              <div className="flex items-center justify-between w-full">
                                <div className="text-left">
                                  <p className="font-medium truncate leading-tight">{bin.name}</p>
                                  <p className="text-[11px] text-emerald-600 dark:text-emerald-300 leading-snug">
                                    {(() => {
                                      const pct = typeof bin.fill_pct === 'number'
                                        ? Math.max(0, Math.min(100, Math.round(Number(bin.fill_pct))))
                                        : (() => { const t = Number(bin.data?.tds ?? NaN); return isFinite(t) ? Math.max(0, Math.min(100, Math.round(((t - 200) / 600) * 100))) : null; })();
                                      const pctText = pct == null ? 'N/A' : `${pct}%`;
                                      const lid = typeof bin.is_open === 'boolean' ? (bin.is_open ? 'Open' : 'Closed') : (bin.status === 'offline' ? '—' : 'Unknown');
                                      const statusText = bin.status === 'offline' ? 'Offline' : 'Online';
                                      return `Level ${pctText} • ${statusText} • Lid ${lid}`;
                                    })()}
                                  </p>
                                </div>
                                <div className={`w-3 h-3 rounded-full ${
                                  bin.status === 'active' ? 'bg-green-500' :
                                  bin.status === 'warning' ? 'bg-yellow-500' :
                                  bin.status === 'critical' ? 'bg-red-500' :
                                  'bg-gray-500'
                                }`} />
                                {role === 'admin' && (
                                  <Button size="sm" variant="secondary" className="ml-2 h-7 text-[11px]"
                                    onClick={(e) => { e.stopPropagation(); setReportBin({ id: bin.id, name: bin.name, fill: typeof bin.fill_pct==='number'?Math.round(bin.fill_pct):undefined, is_open: typeof bin.is_open==='boolean'?bin.is_open:undefined }); setReportNote(''); setReportOpen(true); }}
                                  >
                                    Send report
                                  </Button>
                                )}
                              </div>
                            </Button>
                          </motion.div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="analytics" className="flex-1 overflow-auto space-y-4">
                      <Card className="bg-card/90 dark:bg-card/90 backdrop-blur-sm border border-gray-200/60 dark:border-gray-800/60 shadow-sm">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base font-semibold tracking-tight">System Analytics</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                          <p className="text-xl font-bold text-blue-600 dark:text-blue-400 leading-tight">
                            {bins.length}
                          </p>
                              <p className="text-sm text-gray-600 dark:text-gray-400">Total Bins</p>
                        </div>
                        <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                          <p className="text-xl font-bold text-green-600 dark:text-green-400 leading-tight">
                            {bins.filter((w) => w.status === 'active').length}
                          </p>
                              <p className="text-sm text-gray-600 dark:text-gray-400">Closed</p>
                        </div>
                        <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                          <p className="text-xl font-bold text-yellow-600 dark:text-yellow-400 leading-tight">
                            {bins.filter((w) => w.status === 'warning' || w.status === 'critical').length}
                          </p>
                              <p className="text-sm text-gray-600 dark:text-gray-400">Open</p>
                        </div>
                        <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                          <p className="text-xl font-bold text-red-600 dark:text-red-400 leading-tight">
                            {bins.filter((w) => w.status === 'offline').length}
                          </p>
                              <p className="text-sm text-gray-600 dark:text-gray-400">Offline</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  {/* AI Predictive Graph (monthly) - placeholder using current data */}
                  <Card className="bg-card/90 dark:bg-card/90 backdrop-blur-sm border border-gray-200/60 dark:border-gray-800/60 shadow-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base font-semibold tracking-tight">AI Predictive Fill (Monthly)</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-1">
                      {(() => {
                        const days = Array.from({ length: 30 }, (_, i) => i + 1);
                        // Build naive baseline: average current derived fill as base, add small variance
                        const avgFill = bins.length
                          ? Math.round(
                              bins.reduce((s: number, w: BinData) => {
                                const pct = Math.max(0, Math.min(100, Math.round(((Number(w.data.tds) - 200) / 600) * 100)));
                                return s + pct;
                              }, 0) / bins.length
                            )
                          : 0;
                        const data = days.map((d) => ({
                          day: d,
                          predicted: Math.max(0, Math.min(100, Math.round(avgFill + Math.sin(d / 4) * 5 + (d * 0.6))))
                        }));
                        return (
                          <div className="h-48">
                            <ChartContainer config={{ predicted: { label: 'Predicted', color: 'hsl(200 98% 39%)' } }}>
                              <ResponsiveContainer>
                                <LineChart data={data} margin={{ left: 6, right: 6, top: 6, bottom: 0 }}>
                                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                                  <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                                  <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                                  <Line type="monotone" dataKey="predicted" stroke="var(--color-predicted)" strokeWidth={2} dot={false} />
                                  <ChartTooltip content={<ChartTooltipContent />} />
                                  <ChartLegend content={<ChartLegendContent />} />
                                </LineChart>
                              </ResponsiveContainer>
                            </ChartContainer>
                          </div>
                        );
                      })()}
                    </CardContent>
                  </Card>
                  {/* Overall bins graph */}
                  <Card className="bg-card/90 dark:bg-card/90 backdrop-blur-sm border border-gray-200/60 dark:border-gray-800/60 shadow-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base font-semibold tracking-tight">Overall Bin Levels</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-1">
                      {(() => {
                        const data = bins.map((w: BinData) => {
                          const level = typeof w.fill_pct === 'number'
                            ? Math.max(0, Math.min(100, Math.round(w.fill_pct)))
                            : (() => { const t = Number(w.data?.tds ?? NaN); return isFinite(t) ? Math.max(0, Math.min(100, Math.round(((t - 200) / 600) * 100))) : 0; })();
                          return {
                            name: w.name.length > 10 ? w.name.slice(0, 10) + '…' : w.name,
                            level
                          };
                        });
                        return (
                          <div className="h-48">
                            <ChartContainer config={{ level: { label: 'Level', color: 'hsl(142 72% 29%)' } }}>
                              <ResponsiveContainer>
                                <LineChart data={data} margin={{ left: 6, right: 6, top: 6, bottom: 0 }}>
                                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                                  <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} height={50} />
                                  <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                                  <Line type="monotone" dataKey="level" stroke="var(--color-level)" strokeWidth={2} dot={false} />
                                  <ChartTooltip content={<ChartTooltipContent />} />
                                  <ChartLegend content={<ChartLegendContent />} />
                                </LineChart>
                              </ResponsiveContainer>
                            </ChartContainer>
                          </div>
                        );
                      })()}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Route Planner Tab */}
                <TabsContent value="route" className="flex-1 overflow-auto space-y-4">
                  <RoutePlanner bins={bins} />
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
        {/* Admin: Send Report Dialog */}
        <Dialog open={reportOpen} onOpenChange={(open) => { setReportOpen(open); if (!open) { setReportBin(null); setReportNote(''); } }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Send report{reportBin ? ` — ${reportBin.name}` : ''}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  This email will be sent to the bin owner with the latest status. You can include an optional note.
                </p>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Note</label>
                <Textarea
                  value={reportNote}
                  onChange={(e) => setReportNote(e.target.value)}
                  placeholder="Add any notes or instructions…"
                  className="min-h-[96px] text-sm"
                />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="ghost" onClick={() => { setReportOpen(false); setReportBin(null); setReportNote(''); }}>Cancel</Button>
              <Button
                onClick={async () => {
                  if (!reportBin) { setReportOpen(false); return; }
                  try {
                    const res = await fetch(`/api/bins/${reportBin.id}/send-report`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ reason: 'manual', note: reportNote || undefined, fill_pct: reportBin.fill, is_open: reportBin.is_open })
                    });
                    if (!res.ok) {
                      const msg = await res.text();
                      console.error('Report send failed:', msg);
                    }
                  } catch (err) {
                    console.error('Report send error:', err);
                  } finally {
                    setReportOpen(false);
                    setReportBin(null);
                    setReportNote('');
                  }
                }}
              >
                Send report
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </motion.div>
    </div>
  );
}

// --- Helper Components Added Below ---
// (useEffect already imported at top)

interface RoutePlannerProps { bins: BinData[] }

function RoutePlanner({ bins }: RoutePlannerProps) {
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
    ? bins.map(b => ({
        bin: b,
        distanceKm: haversine(position.coords.latitude, position.coords.longitude, b.location.lat, b.location.lng)
      }))
    : [];

  // Simple nearest-neighbor route (placeholder for full TSP) starting at user position
  const routeOrder = () => {
    if (!position || bins.length === 0) return [] as { name: string; distanceFromPrev: number }[];
    const remaining = [...bins];
    let currentLat = position.coords.latitude;
    let currentLng = position.coords.longitude;
    const order: { name: string; distanceFromPrev: number }[] = [];
    while (remaining.length) {
      let bestIdx = 0;
      let bestDist = Infinity;
      for (let i = 0; i < remaining.length; i++) {
        const d = haversine(currentLat, currentLng, remaining[i].location.lat, remaining[i].location.lng);
        if (d < bestDist) { bestDist = d; bestIdx = i; }
      }
      const next = remaining.splice(bestIdx, 1)[0];
      order.push({ name: next.name, distanceFromPrev: bestDist });
      currentLat = next.location.lat; currentLng = next.location.lng;
    }
    return order;
  };

  const order = routeOrder();
  const totalDistance = order.reduce((sum, o) => sum + o.distanceFromPrev, 0);

  useEffect(() => {
    if (!position || order.length === 0) { setOptLink(null); return; }
    // Build Google Maps directions URL: origin -> waypoints -> destination (last)
    // If only one bin: origin user position to that bin.
    const origin = `${position.coords.latitude},${position.coords.longitude}`;
    const coordsList: string[] = [];
    let prevLat = position.coords.latitude;
    let prevLng = position.coords.longitude;
    let totalKm = 0;
    order.forEach(o => {
      const b = bins.find(bn => bn.name === o.name);
      if (b) {
        coordsList.push(`${b.location.lat},${b.location.lng}`);
        totalKm += o.distanceFromPrev;
        prevLat = b.location.lat; prevLng = b.location.lng;
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
  }, [order, position, bins]);

  const estimatedMinutes = (totalDistance / 40) * 60; // crude avg 40km/h

  return (
  <Card className="bg-card/90 dark:bg-card/90 backdrop-blur-sm border border-gray-200/60 dark:border-gray-800/60 shadow-sm">
      <CardHeader className="pb-2">
  <CardTitle className="text-base font-semibold tracking-tight">Route</CardTitle>
        <p className="text-xs text-gray-500 dark:text-gray-400">Shortest greedy path suggestion with live distance. Open in Google Maps for navigation.</p>
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
              <div key={d.bin.id} className="flex items-center justify-between rounded-md px-2 py-1 bg-gray-100/70 dark:bg-gray-900/40">
                <span className="font-medium text-gray-800 dark:text-gray-200">{d.bin.name}</span>
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
        {position && bins.length <= 1 && (
          <>
            <div className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">Add more bins to compute multi-stop routes.</div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

interface ChatMessage { role: 'user' | 'assistant'; content: string }

function AIChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([
  { role: 'assistant', content: 'Hi! I\'m your BinLink AI assistant. Ask me about bin fill levels, status, or get a quick summary.' }
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
      const res = await fetch('/api/chat?stream=1', {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: base.slice(-10), stream: true })
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
      if (!res.body) throw new Error('No stream body');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let assistantText = '';
      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
            assistantText += chunk;
            setMessages(prev => {
              const copy = [...prev];
              // last message is assistant placeholder
              copy[copy.length - 1] = { role: 'assistant', content: assistantText };
              return copy;
            });
        }
      }
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
        <p className="text-xs text-gray-500 dark:text-gray-400">Gemini powered assistant. Streaming enabled.</p>
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