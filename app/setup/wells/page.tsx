"use client";

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUser } from '@/components/user-context';
import { useTheme } from 'next-themes';
import 'leaflet/dist/leaflet.css';
import { v4 as uuid } from 'uuid';
import { generateHistory, WellData } from '@/lib/well-data';

interface DraftWell { id: string; name: string; village?: string; panchayat_name?: string; lat: string; lng: string; }

export default function SetupWellsPage() {
	const [wells, setWells] = useState<DraftWell[]>([]);
	const [saving, setSaving] = useState(false);
	const [form, setForm] = useState<{ name: string; village: string; panchayat_name: string; lat: string; lng: string }>({ name: '', village: '', panchayat_name: '', lat: '', lng: '' });
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
				// Prefer Stadia only if an API key is configured; otherwise fallback to Carto Dark to avoid 401s
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
					className: 'well-setup-divicon',
					html: '<div style="width:16px;height:16px;border-radius:50%;background:#10b981;box-shadow:0 0 0 3px rgba(16,185,129,0.35),0 2px 4px -1px rgba(0,0,0,0.4);border:2px solid #ffffff"></div>',
					iconSize: [16, 16],
					iconAnchor: [8, 8]
				});
			}
			wells.forEach(w => {
				const lat = Number(w.lat); const lng = Number(w.lng);
				if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
					L.marker([lat, lng], { icon: customIconRef.current }).addTo(layerRef.current).bindTooltip(w.name || 'Well');
				}
			});
		})();
	}, [wells]);

	const resetForm = () => setForm({ name: '', village: '', panchayat_name: '', lat: '', lng: '' });

	const addWell = () => {
		setError(null);
		if (!form.name.trim()) return setError('Name required');
		// Village optional, but trim whitespace
		const village = form.village.trim();
		const latNum = Number(form.lat);
		const lngNum = Number(form.lng);
		if (Number.isNaN(latNum) || Number.isNaN(lngNum)) return setError('Latitude & longitude must be numbers');
		if (latNum < -90 || latNum > 90) return setError('Latitude must be between -90 and 90');
		if (lngNum < -180 || lngNum > 180) return setError('Longitude must be between -180 and 180');
		 const panchayatName = form.panchayat_name.trim();
		 const draft: DraftWell = { id: uuid(), name: form.name.trim(), village: village || undefined, panchayat_name: panchayatName || undefined, lat: latNum.toString(), lng: lngNum.toString() };
		setWells(list => [...list, draft]);
		resetForm();
	};

	const updateWell = (id: string, patch: Partial<DraftWell>) => {
		setWells(list => list.map(w => w.id === id ? { ...w, ...patch } : w));
	};
	const removeWell = (id: string) => setWells(list => list.filter(w => w.id !== id));
	const confirmRemove = (id: string) => setConfirmRemoveId(id);
	const doRemove = () => { if (confirmRemoveId) { removeWell(confirmRemoveId); setConfirmRemoveId(null);} };
	const cancelRemove = () => setConfirmRemoveId(null);

	const persist = async () => {
		setSaving(true);
		 const payload: any[] = wells.map(w => ({
			id: w.id,
			name: w.name || 'Untitled Well',
			village: w.village,
			 panchayat_name: w.panchayat_name,
			location: { lat: Number(w.lat), lng: Number(w.lng) },
			data: { ph: 7.2, tds: 360, temperature: 26.1, waterLevel: 42, lastUpdated: new Date() },
			status: 'active',
			history: generateHistory()
		}));
		localStorage.setItem('customWells', JSON.stringify(payload));
		if (user) {
			// TODO: send to /api/wells (POST) endpoint for persistence when implemented
			try { await fetch('/api/wells', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ wells: payload }) }); } catch {}
		}
		setTimeout(() => { setSaving(false); setToast('Wells saved successfully'); setTimeout(()=> setToast(null), 3000); }, 500);
	};

	return (
		<div className="min-h-[calc(100vh-0px)] w-full bg-background text-foreground transition-colors py-16 flex flex-col">
			<div className="max-w-7xl mx-auto px-6 flex-1 w-full flex flex-col">
				<header className="mb-10 flex flex-col items-center justify-center text-center flex-grow">
					<div>
						<h1 className="text-3xl sm:text-4xl font-semibold tracking-tight bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 dark:from-emerald-300 dark:via-teal-200 dark:to-cyan-300 bg-clip-text text-transparent">Setup Wells</h1>
						<p className="mt-2 text-sm text-muted-foreground max-w-2xl mx-auto">Add your wells by clicking the map or entering coordinates. Manage and review them before saving to your dashboard.</p>
					</div>
				</header>
				<div className="grid md:grid-cols-2 gap-10 items-start">
					<section aria-label="Register Well" className="rounded-2xl border border-border/80 bg-card/80 dark:bg-card/50 backdrop-blur-xl shadow-lg shadow-black/5 dark:shadow-black/40 flex flex-col h-[600px] overflow-hidden">
						<div className="p-7 pb-4 border-b border-border/70">
							<h2 className="text-base font-semibold tracking-tight">Register Well</h2>
						</div>
						<div className="p-7 pt-6 flex-1 flex flex-col min-h-0">
							<div className="grid gap-5">
									<div className="grid gap-4 sm:grid-cols-2">
										<div className="space-y-2 sm:col-span-2">
										<label className="block text-[12px] font-medium text-muted-foreground">Name</label>
										<input value={form.name} onChange={e=> setForm(f=>({...f,name:e.target.value}))} placeholder="Enter well name" className="w-full rounded-xl bg-muted/40 dark:bg-white/10 border border-border/60 px-4 py-2.5 text-sm outline-none focus:border-emerald-400/70 focus:ring-2 focus:ring-emerald-400/20 transition" />
									</div>
									<div className="space-y-2">
										<label className="block text-[12px] font-medium text-muted-foreground">Village (optional)</label>
										<input value={form.village} onChange={e=> setForm(f=>({...f,village:e.target.value}))} placeholder="Village name" className="w-full rounded-xl bg-muted/40 dark:bg-white/10 border border-border/60 px-4 py-2.5 text-sm outline-none focus:border-emerald-400/70 focus:ring-2 focus:ring-emerald-400/20 transition" />
									</div>
									<div className="space-y-2">
										<label className="block text-[12px] font-medium text-muted-foreground">Panchayat Name (optional)</label>
										<input value={form.panchayat_name} onChange={e=> setForm(f=>({...f,panchayat_name:e.target.value}))} placeholder="Panchayat" className="w-full rounded-xl bg-muted/40 dark:bg-white/10 border border-border/60 px-4 py-2.5 text-sm outline-none focus:border-emerald-400/70 focus:ring-2 focus:ring-emerald-400/20 transition" />
									</div>
									<div className="space-y-2">
										<label className="block text-[12px] font-medium text-muted-foreground">Latitude</label>
										<input value={form.lat} onChange={e=> setForm(f=>({...f,lat:e.target.value}))} placeholder="15.48853" className="w-full rounded-xl bg-muted/40 dark:bg-white/10 border border-border/60 px-4 py-2.5 text-sm outline-none focus:border-emerald-400/70 focus:ring-2 focus:ring-emerald-400/20 transition" />
									</div>
									<div className="space-y-2">
										<label className="block text-[12px] font-medium text-muted-foreground">Longitude</label>
										<input value={form.lng} onChange={e=> setForm(f=>({...f,lng:e.target.value}))} placeholder="73.85236" className="w-full rounded-xl bg-muted/40 dark:bg-white/10 border border-border/60 px-4 py-2.5 text-sm outline-none focus:border-emerald-400/70 focus:ring-2 focus:ring-emerald-400/20 transition" />
									</div>
									</div>
								{error && <p className="text-xs text-red-600 dark:text-red-300">{error}</p>}
								<div className="flex items-center gap-3">
									<button onClick={addWell} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-sm font-medium px-5 py-2.5 shadow shadow-emerald-900/30 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60">
										<span className="text-lg leading-none">+</span> Add Well
									</button>
									<button onClick={persist} disabled={!wells.length || saving} className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold px-5 py-2.5 shadow shadow-emerald-900/20 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60">{saving? 'Saving...' : 'Save All'}</button>
								</div>
								<p className="text-[11px] text-muted-foreground leading-relaxed">Click map or enter coordinates. Lat -90→90 • Lng -180→180</p>
							</div>
							<div className="mt-6 flex items-center justify-between">
								<h3 className="text-xs font-medium tracking-wide text-foreground/70 uppercase">Registered Wells <span className="text-muted-foreground font-normal">({wells.length})</span></h3>
							</div>
							<div className="mt-4 flex-1 overflow-auto pr-1 space-y-3 custom-scroll">
								<AnimatePresence initial={false}>
								{wells.length === 0 && (
									<motion.div initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} exit={{opacity:0}} className="text-[12px] text-muted-foreground border border-dashed border-border rounded-lg p-5 text-center">
										No wells yet. Click the map or use the form.
									</motion.div>
								)}
								{wells.map(w => (
									<motion.div layout key={w.id} initial={{opacity:0, scale:0.96}} animate={{opacity:1, scale:1}} exit={{opacity:0, scale:0.92}} className="group relative rounded-xl bg-card/70 dark:bg-white/5 border border-border/80 hover:border-emerald-400/50 p-4 flex flex-col gap-3 cursor-pointer transition-colors">
										<div className="flex items-start gap-3" onClick={() => {
											if (mapRef.current) { try { mapRef.current.setView([Number(w.lat), Number(w.lng)], 11, { animate: true }); } catch {} }
										}}>
											<div className="flex-1">
												<input value={w.name} onClick={e=> e.stopPropagation()} onChange={e=> updateWell(w.id,{name:e.target.value})} className="w-full bg-transparent text-sm font-medium outline-none" />
												<div className="mt-1 grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
													<div className="flex items-center gap-1.5">
														<span className="text-muted-foreground/60">Lat</span>
														<input value={w.lat} onClick={e=> e.stopPropagation()} onChange={e=> updateWell(w.id,{lat:e.target.value})} className="bg-muted/40 dark:bg-white/10 rounded px-1.5 py-0.5 w-full text-[11px] outline-none border border-border/60" />
													</div>
													<div className="flex items-center gap-1.5">
														<span className="text-muted-foreground/60">Lng</span>
														<input value={w.lng} onClick={e=> e.stopPropagation()} onChange={e=> updateWell(w.id,{lng:e.target.value})} className="bg-muted/40 dark:bg-white/10 rounded px-1.5 py-0.5 w-full text-[11px] outline-none border border-border/60" />
													</div>
													{w.village !== undefined && (
														<div className="col-span-2 flex items-center gap-1.5">
															<span className="text-muted-foreground/60">Village</span>
															<input value={w.village} onClick={e=> e.stopPropagation()} onChange={e=> updateWell(w.id,{village:e.target.value})} className="bg-muted/40 dark:bg-white/10 rounded px-1.5 py-0.5 w-full text-[11px] outline-none border border-border/60" placeholder="Village" />
														</div>
													)}
													{w.panchayat_name !== undefined && (
														<div className="col-span-2 flex items-center gap-1.5">
															<span className="text-muted-foreground/60">Panchayat</span>
															<input value={w.panchayat_name} onClick={e=> e.stopPropagation()} onChange={e=> updateWell(w.id,{panchayat_name:e.target.value})} className="bg-muted/40 dark:bg-white/10 rounded px-1.5 py-0.5 w-full text-[11px] outline-none border border-border/60" placeholder="Panchayat" />
														</div>
													)}
												</div>
											</div>
											<button type="button" onClick={(e)=> { e.stopPropagation(); confirmRemove(w.id); }} className="ml-auto text-xs text-red-500 hover:text-red-400 rounded-md px-2 py-1.5 bg-red-500/10 hover:bg-red-500/15 transition">Remove</button>
										</div>
									</motion.div>
								))}
								</AnimatePresence>
								{wells.length > 0 && <p className="text-[10px] text-muted-foreground">Press <span className="text-emerald-600 dark:text-emerald-300 font-medium">Save All</span> to persist locally.</p>}
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
							<motion.div initial={{opacity:0, y:8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-4}} className="absolute inset-x-0 top-0 z-[500] flex justify-center pt-6">
								<div className="text-[12px] bg-background/80 dark:bg-black/70 px-4 py-2 rounded-full border border-border backdrop-blur-md shadow flex items-center gap-2">
									<span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" /> Click map to set coordinates
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
					<div className="px-5 py-3 rounded-xl bg-emerald-600 text-white text-sm shadow-lg shadow-emerald-900/30 flex items-center gap-2">
						<span className="font-medium">{toast}</span>
					</div>
				</motion.div>)}
			</AnimatePresence>
			{/* Confirm Remove Dialog */}
			<AnimatePresence>{confirmRemoveId && (
				<motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-[4000] flex items-center justify-center p-4">
					<div onClick={cancelRemove} className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
					<motion.div initial={{scale:0.9, opacity:0}} animate={{scale:1, opacity:1}} exit={{scale:0.9, opacity:0}} className="relative w-full max-w-sm rounded-2xl bg-card border border-border p-6 shadow-xl">
						<h4 className="text-sm font-semibold mb-2">Remove Well?</h4>
						<p className="text-xs text-muted-foreground mb-5">Are you sure you want to remove this well?</p>
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
