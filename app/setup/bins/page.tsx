"use client";

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUser } from '@/components/user-context';
import { useTheme } from 'next-themes';
import 'leaflet/dist/leaflet.css';
import { v4 as uuid } from 'uuid';

interface DraftBin { id: string; name: string; bin_type: 'private' | 'public'; location_label?: string; lat: string; lng: string; }

export default function SetupBinsPage() {
  const [bins, setBins] = useState<DraftBin[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<{ name: string; bin_type: 'private'|'public'; location_label: string; lat: string; lng: string }>({ name: '', bin_type: 'private', location_label: '', lat: '', lng: '' });
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const { user } = useUser();
  const [showMapHint, setShowMapHint] = useState(true);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const { resolvedTheme } = useTheme();
  // Map refs
  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const layerRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);
  const initializingRef = useRef(false);
  const customIconRef = useRef<any>(null);

  // Lazy init map when component mounts
  useEffect(() => {
    (async () => {
      const el = mapEl.current;
      if (!el) return;
      if (mapRef.current || initializingRef.current || el.classList.contains('leaflet-container')) return;
      initializingRef.current = true;
      try {
        const L = await import('leaflet');
        mapRef.current = L.map(el, { center: [15.48853,73.85236], zoom: 8 });
        const stadiaKey = (process.env.NEXT_PUBLIC_STADIA_API_KEY || (globalThis as any).NEXT_PUBLIC_STADIA_API_KEY) as string | undefined;
        const darkUrl = stadiaKey
          ? `https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png?api_key=${encodeURIComponent(stadiaKey)}`
          : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
        const url = resolvedTheme === 'light'
          ? 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
          : darkUrl;
        tileLayerRef.current = L.tileLayer(url, { maxZoom: 19 });
        tileLayerRef.current.addTo(mapRef.current);
        layerRef.current = L.layerGroup().addTo(mapRef.current);
        mapRef.current.on('click', (e: any) => {
          const { lat, lng } = e.latlng;
          setForm(f => ({ ...f, lat: lat.toFixed(5), lng: lng.toFixed(5) }));
          setShowMapHint(false);
        });
      } catch (e) {
        if (!(e as any)?.message?.match(/already initialized/i)) throw e;
      } finally {
        initializingRef.current = false;
      }
    })();
    return () => { if (mapRef.current) { try { mapRef.current.remove(); } catch { } mapRef.current = null; layerRef.current = null; tileLayerRef.current = null; } };
  }, [resolvedTheme]);

  useEffect(() => {
    (async () => {
      if (!mapRef.current) return;
      const L = await import('leaflet');
      const stadiaKey = (process.env.NEXT_PUBLIC_STADIA_API_KEY || (globalThis as any).NEXT_PUBLIC_STADIA_API_KEY) as string | undefined;
      const darkUrl = stadiaKey
        ? `https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png?api_key=${encodeURIComponent(stadiaKey)}`
        : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
      const nextUrl = resolvedTheme === 'light'
        ? 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
        : darkUrl;
      const currentUrl = tileLayerRef.current?._url;
      if (currentUrl === nextUrl) return;
      if (tileLayerRef.current) {
        try { mapRef.current.removeLayer(tileLayerRef.current); } catch { }
      }
      tileLayerRef.current = L.tileLayer(nextUrl, { maxZoom: 19 });
      tileLayerRef.current.addTo(mapRef.current);
    })();
  }, [resolvedTheme]);

  useEffect(() => {
    (async () => {
      if (!layerRef.current) return;
      const L = await import('leaflet');
      layerRef.current.clearLayers();
      if (!customIconRef.current) {
        customIconRef.current = L.divIcon({
          className: 'bin-setup-divicon',
          html: '<div style="width:16px;height:16px;border-radius:50%;background:#0ea5e9;box-shadow:0 0 0 3px rgba(14,165,233,0.35),0 2px 4px -1px rgba(0,0,0,0.4);border:2px solid #ffffff"></div>',
          iconSize: [16, 16],
          iconAnchor: [8, 8]
        });
      }
      bins.forEach(b => {
        const lat = Number(b.lat); const lng = Number(b.lng);
        if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
          L.marker([lat, lng], { icon: customIconRef.current }).addTo(layerRef.current).bindTooltip(b.name || 'Bin');
        }
      });
    })();
  }, [bins]);

  const resetForm = () => setForm({ name: '', bin_type: 'private', location_label: '', lat: '', lng: '' });

  const addBin = () => {
    setError(null);
    if (!form.name.trim()) return setError('Name required');
    const latNum = Number(form.lat);
    const lngNum = Number(form.lng);
    if (Number.isNaN(latNum) || Number.isNaN(lngNum)) return setError('Latitude & longitude must be numbers');
    if (latNum < -90 || latNum > 90) return setError('Latitude must be between -90 and 90');
    if (lngNum < -180 || lngNum > 180) return setError('Longitude must be between -180 and 180');
    const draft: DraftBin = { id: uuid(), name: form.name.trim(), bin_type: form.bin_type, location_label: form.location_label.trim() || undefined, lat: latNum.toString(), lng: lngNum.toString() };
    setBins(list => [...list, draft]);
    resetForm();
  };

  const updateBin = (id: string, patch: Partial<DraftBin>) => {
    setBins(list => list.map(b => b.id === id ? { ...b, ...patch } : b));
  };
  const removeBin = (id: string) => setBins(list => list.filter(b => b.id !== id));
  const confirmRemove = (id: string) => setConfirmRemoveId(id);
  const doRemove = () => { if (confirmRemoveId) { removeBin(confirmRemoveId); setConfirmRemoveId(null);} };
  const cancelRemove = () => setConfirmRemoveId(null);

  const persist = async () => {
    setSaving(true);
    const payload: any[] = bins.map(b => ({
      id: b.id,
      name: b.name || 'Untitled Bin',
      bin_type: b.bin_type,
      location_label: b.location_label,
      location: { lat: Number(b.lat), lng: Number(b.lng) },
      status: 'active',
      data: { fill_pct: Math.round(Math.random()*40 + 10), lastUpdated: new Date(), is_open: false },
    }));
    // Persist locally as a draft
    localStorage.setItem('customBins', JSON.stringify(payload));
    let serverOk = true;
    if (user) {
      try {
        const resp = await fetch('/api/bins', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bins: payload }) });
        if (!resp.ok) serverOk = false;
      } catch { serverOk = false; }
    }
    setSaving(false);
    setToast(serverOk ? 'Bins saved to your account' : 'Saved locally. Server save failed — check login and try again.');
    setTimeout(()=> setToast(null), 3500);
  };

  return (
    <div className="min-h-[calc(100vh-0px)] w-full bg-background text-foreground transition-colors py-16 flex flex-col">
      <div className="max-w-7xl mx-auto px-6 flex-1 w-full flex flex-col">
        <header className="mb-10 flex flex-col items-center justify-center text-center flex-grow">
          <div>
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight bg-gradient-to-r from-sky-500 via-cyan-400 to-emerald-400 dark:from-sky-300 dark:via-cyan-200 dark:to-emerald-300 bg-clip-text text-transparent">Register Bins</h1>
            <p className="mt-2 text-sm text-muted-foreground max-w-2xl mx-auto">Add public or private bins by clicking the map or entering coordinates. Manage and review them before saving to your dashboard.</p>
          </div>
        </header>
        <div className="grid md:grid-cols-2 gap-10 items-start">
          <section aria-label="Register Bin" className="rounded-2xl border border-border/80 bg-card/80 dark:bg-card/50 backdrop-blur-xl shadow-lg shadow-black/5 dark:shadow-black/40 flex flex-col h-[600px] overflow-hidden">
            <div className="p-7 pb-4 border-b border-border/70">
              <h2 className="text-base font-semibold tracking-tight">Register Bin</h2>
            </div>
            <div className="p-7 pt-6 flex-1 flex flex-col min-h-0">
              <div className="grid gap-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <label className="block text-[12px] font-medium text-muted-foreground">Bin Name</label>
                    <input value={form.name} onChange={e=> setForm(f=>({...f,name:e.target.value}))} placeholder="Enter bin name" className="w-full rounded-xl bg-muted/40 dark:bg-white/10 border border-border/60 px-4 py-2.5 text-sm outline-none focus:border-sky-400/70 focus:ring-2 focus:ring-sky-400/20 transition" />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[12px] font-medium text-muted-foreground">Bin Type</label>
                    <select value={form.bin_type} onChange={e=> setForm(f=>({...f, bin_type: e.target.value as 'private'|'public'}))} className="w-full rounded-xl bg-muted/40 dark:bg-gray-900/60 border border-border/60 px-3 py-2.5 text-sm outline-none focus:border-sky-400/70 focus:ring-2 focus:ring-sky-400/20 transition text-foreground">
                      <option value="private">Private</option>
                      <option value="public">Public</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[12px] font-medium text-muted-foreground">Location Label (optional)</label>
                    <input value={form.location_label} onChange={e=> setForm(f=>({...f,location_label:e.target.value}))} placeholder="Area / Street / Landmark" className="w-full rounded-xl bg-muted/40 dark:bg-white/10 border border-border/60 px-4 py-2.5 text-sm outline-none focus:border-sky-400/70 focus:ring-2 focus:ring-sky-400/20 transition" />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[12px] font-medium text-muted-foreground">Latitude</label>
                    <input value={form.lat} onChange={e=> setForm(f=>({...f,lat:e.target.value}))} placeholder="15.48853" className="w-full rounded-xl bg-muted/40 dark:bg-white/10 border border-border/60 px-4 py-2.5 text-sm outline-none focus:border-sky-400/70 focus:ring-2 focus:ring-sky-400/20 transition" />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[12px] font-medium text-muted-foreground">Longitude</label>
                    <input value={form.lng} onChange={e=> setForm(f=>({...f,lng:e.target.value}))} placeholder="73.85236" className="w-full rounded-xl bg-muted/40 dark:bg-white/10 border border-border/60 px-4 py-2.5 text-sm outline-none focus:border-sky-400/70 focus:ring-2 focus:ring-sky-400/20 transition" />
                  </div>
                </div>
                {error && <p className="text-xs text-red-600 dark:text-red-300">{error}</p>}
                <div className="flex items-center gap-3">
                  <button onClick={addBin} className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white text-sm font-medium px-5 py-2.5 shadow shadow-sky-900/30 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60">
                    <span className="text-lg leading-none">+</span> Add Bin
                  </button>
                  <button onClick={persist} disabled={!bins.length || saving} className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-sky-500 to-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold px-5 py-2.5 shadow shadow-sky-900/20 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60">{saving? 'Saving...' : 'Save All'}</button>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">Click map or enter coordinates. Lat -90→90 • Lng -180→180</p>
              </div>
              <div className="mt-6 flex items-center justify-between">
                <h3 className="text-xs font-medium tracking-wide text-foreground/70 uppercase">Registered Bins <span className="text-muted-foreground font-normal">({bins.length})</span></h3>
              </div>
              <div className="mt-4 flex-1 overflow-auto pr-1 space-y-3 custom-scroll">
                <AnimatePresence initial={false}>
                  {bins.length === 0 && (
                    <motion.div initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} exit={{opacity:0}} className="text-[12px] text-muted-foreground border border-dashed border-border rounded-lg p-5 text-center">
                      No bins yet. Click the map or use the form.
                    </motion.div>
                  )}
                  {bins.map(b => (
                    <motion.div layout key={b.id} initial={{opacity:0, scale:0.96}} animate={{opacity:1, scale:1}} exit={{opacity:0, scale:0.92}} className="group relative rounded-xl bg-card/70 dark:bg-white/5 border border-border/80 hover:border-sky-400/50 p-4 flex flex-col gap-3 cursor-pointer transition-colors">
                      <div className="flex items-start gap-3" onClick={() => {
                        if (mapRef.current) { try { mapRef.current.setView([Number(b.lat), Number(b.lng)], 11, { animate: true }); } catch {} }
                      }}>
                        <div className="flex-1">
                          <input value={b.name} onClick={e=> e.stopPropagation()} onChange={e=> updateBin(b.id,{name:e.target.value})} className="w-full bg-transparent text-sm font-medium outline-none" />
                          <div className="mt-1 grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                            <div className="flex items-center gap-1.5">
                              <span className="text-muted-foreground/60">Lat</span>
                              <input value={b.lat} onClick={e=> e.stopPropagation()} onChange={e=> updateBin(b.id,{lat:e.target.value})} className="bg-muted/40 dark:bg-white/10 rounded px-1.5 py-0.5 w-full text-[11px] outline-none border border-border/60" />
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-muted-foreground/60">Lng</span>
                              <input value={b.lng} onClick={e=> e.stopPropagation()} onChange={e=> updateBin(b.id,{lng:e.target.value})} className="bg-muted/40 dark:bg-white/10 rounded px-1.5 py-0.5 w-full text-[11px] outline-none border border-border/60" />
                            </div>
                            <div className="col-span-2 flex items-center gap-1.5">
                              <span className="text-muted-foreground/60">Type</span>
                              <select value={b.bin_type} onClick={e=> e.stopPropagation()} onChange={e=> updateBin(b.id,{bin_type: e.target.value as 'private'|'public'})} className="bg-muted/40 dark:bg-gray-900/60 text-foreground rounded px-1.5 py-0.5 w-full text-[11px] outline-none border border-border/60">
                                <option value="private">Private</option>
                                <option value="public">Public</option>
                              </select>
                            </div>
                            <div className="col-span-2 flex items-center gap-1.5">
                              <span className="text-muted-foreground/60">Label</span>
                              <input value={b.location_label || ''} onClick={e=> e.stopPropagation()} onChange={e=> updateBin(b.id,{location_label:e.target.value})} className="bg-muted/40 dark:bg-white/10 rounded px-1.5 py-0.5 w-full text-[11px] outline-none border border-border/60" placeholder="Area / Street / Landmark" />
                            </div>
                          </div>
                        </div>
                        <button type="button" onClick={(e)=> { e.stopPropagation(); confirmRemove(b.id); }} className="ml-auto text-xs text-red-500 hover:text-red-400 rounded-md px-2 py-1.5 bg-red-500/10 hover:bg-red-500/15 transition">Remove</button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {bins.length > 0 && <p className="text-[10px] text-muted-foreground">Press <span className="text-sky-600 dark:text-sky-300 font-medium">Save All</span> to persist locally.</p>}
              </div>
              <div className="pt-5 mt-4 border-t border-border/50 flex items-center gap-4 text-[11px] text-muted-foreground">
                <a href="/maps" className="underline hover:text-foreground">Back to Map</a>
                <span>• Stored locally</span>
              </div>
            </div>
          </section>
          <section className="rounded-2xl border border-border bg-card/60 dark:bg-black/40 backdrop-blur-xl shadow-lg h-[600px] relative overflow-hidden" aria-label="Map">
            <div ref={mapEl} className="absolute inset-0 [&_.leaflet-control-zoom]:mt-3 [&_.leaflet-control-zoom]:ml-3" />
            <AnimatePresence>{showMapHint && (
              <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-4}} className="absolute inset-x-0 top-0 z-[500] flex justify-center pt-6">
                <div className="text-[12px] bg-background/80 dark:bg-black/70 px-4 py-2 rounded-full border border-border backdrop-blur-md shadow flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-500 animate-pulse" /> Click map to set coordinates
                  <button onClick={()=> setShowMapHint(false)} className="ml-2 text-xs text-muted-foreground hover:text-foreground">Dismiss</button>
                </div>
              </motion.div>)}
            </AnimatePresence>
          </section>
        </div>
      </div>
      {/* Toast */}
      <AnimatePresence>{toast && (
        <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} exit={{opacity:0,y:10}} className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[3000]">
          <div className="px-5 py-3 rounded-xl bg-sky-600 text-white text-sm shadow-lg shadow-sky-900/30 flex items-center gap-2">
            <span className="font-medium">{toast}</span>
          </div>
        </motion.div>)}
      </AnimatePresence>
      {/* Confirm Remove Dialog */}
      <AnimatePresence>{confirmRemoveId && (
        <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-[4000] flex items-center justify-center p-4">
          <div onClick={cancelRemove} className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <motion.div initial={{scale:0.9, opacity:0}} animate={{scale:1, opacity:1}} exit={{scale:0.9, opacity:0}} className="relative w-full max-w-sm rounded-2xl bg-card border border-border p-6 shadow-xl">
            <h4 className="text-sm font-semibold mb-2">Remove Bin?</h4>
            <p className="text-xs text-muted-foreground mb-5">Are you sure you want to remove this bin?</p>
            <div className="flex justify-end gap-3 text-sm">
              <button onClick={cancelRemove} className="px-4 py-2 rounded-lg bg-muted hover:bg-muted/80 transition">Cancel</button>
              <button onClick={doRemove} className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white shadow">Remove</button>
            </div>
          </motion.div>
        </motion.div>)}
      </AnimatePresence>
    </div>
  );
}
