"use client";
import { useEffect, useMemo, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import { motion, AnimatePresence } from 'framer-motion';

type FormState = {
  full_name: string;
  device_id: string;
  gender: '' | 'male' | 'female' | 'other';
  dob: string;
  address: string;
  email: string;
  phone: string;
  emergency_name: string;
  emergency_phone: string;
  emergency_email: string;
  lat: string;
  lng: string;
};

export default function SetupPatientPage() {
  const [form, setForm] = useState<FormState>({ full_name: '', device_id: '', gender: '', dob: '', address: '', email: '', phone: '', emergency_name: '', emergency_phone: '', emergency_email: '', lat: '', lng: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(false);
  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const tileRef = useRef<any>(null);
  const initting = useRef(false);

  // Initialize leaflet map lazily when overlay opens
  useEffect(() => {
    (async () => {
      if (!showMap) return;
      const el = mapEl.current; if (!el) return;
      if (mapRef.current || initting.current || el.classList.contains('leaflet-container')) return;
      initting.current = true;
      try {
        const L = await import('leaflet');
        const lat = Number(form.lat); const lng = Number(form.lng);
        const hasCoords = !Number.isNaN(lat) && !Number.isNaN(lng);
        mapRef.current = L.map(el, { center: hasCoords ? [lat, lng] : [15.48853, 73.85236], zoom: hasCoords ? 13 : 5 });
        tileRef.current = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 });
        tileRef.current.addTo(mapRef.current);
        if (hasCoords) {
          markerRef.current = L.marker([lat, lng]).addTo(mapRef.current);
        }
        mapRef.current.on('click', (e: any) => {
          const { lat, lng } = e.latlng;
          setForm(f => ({ ...f, lat: lat.toFixed(5), lng: lng.toFixed(5) }));
          if (!markerRef.current) {
            markerRef.current = L.marker([lat, lng]).addTo(mapRef.current);
          } else {
            markerRef.current.setLatLng([lat, lng]);
          }
        });
      } finally {
        initting.current = false;
      }
    })();
    return () => {};
  }, [showMap]);

  useEffect(() => {
    // Clean up map when overlay closes
    if (!showMap && mapRef.current) {
      try { mapRef.current.remove(); } catch {}
      mapRef.current = null; markerRef.current = null; tileRef.current = null;
    }
  }, [showMap]);

  const resetForm = () => setForm({ full_name: '', device_id: '', gender: '', dob: '', address: '', email: '', phone: '', emergency_name: '', emergency_phone: '', emergency_email: '', lat: '', lng: '' });

  const validate = (): string | null => {
    if (!form.full_name.trim()) return 'Patient name is required';
    if (!form.device_id.trim()) return 'Device ID is required';
    const lat = Number(form.lat), lng = Number(form.lng);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return 'Select coordinates on the map or enter valid latitude/longitude';
    if (lat < -90 || lat > 90) return 'Latitude must be between -90 and 90';
    if (lng < -180 || lng > 180) return 'Longitude must be between -180 and 180';
    return null;
  };

  const save = async () => {
    setError(null);
    const v = validate();
    if (v) { setError(v); return; }
    setSaving(true);
    try {
      const body = {
        full_name: form.full_name.trim(),
        device_id: form.device_id.trim(),
        gender: form.gender || null,
        dob: form.dob || null,
        address: form.address || null,
        patient_email: form.email || null,
        patient_phone: form.phone || null,
        emergency_contact_name: form.emergency_name || null,
        emergency_contact_phone: form.emergency_phone || null,
        emergency_contact_email: form.emergency_email || null,
        lat: Number(form.lat),
        lng: Number(form.lng)
      };
      const resp = await fetch('/api/patients', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const json = await resp.json();
      if (!resp.ok) {
        throw new Error(json?.error || 'Failed to register patient');
      }
      setToast('Patient registered');
      resetForm();
    } catch (e: any) {
      setError(e?.message || 'Registration failed');
    } finally {
      setSaving(false);
      setTimeout(() => setToast(null), 3000);
    }
  };

  return (
    <div className="min-h-[calc(100vh-0px)] w-full bg-background text-foreground transition-colors py-16 flex flex-col">
      <div className="max-w-3xl mx-auto px-6 w-full">
        <header className="mb-8 text-center">
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">Register Patient</h1>
          <p className="mt-2 text-sm text-muted-foreground">Enter patient details and select location using the map overlay.</p>
        </header>

        <section className="rounded-2xl border border-border/80 bg-card/80 dark:bg-card/50 backdrop-blur-xl shadow-lg p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-[12px] font-medium text-muted-foreground">Patient Name</label>
              <input value={form.full_name} onChange={e=> setForm(f=>({...f, full_name:e.target.value}))} placeholder="Full name" className="w-full rounded-xl bg-muted/40 dark:bg-white/10 border border-border/60 px-4 py-2.5 text-sm outline-none focus:border-emerald-400/70 focus:ring-2 focus:ring-emerald-400/20 transition" />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-muted-foreground">Device ID</label>
              <input value={form.device_id} onChange={e=> setForm(f=>({...f, device_id:e.target.value}))} placeholder="e.g. DEV-1001" className="w-full rounded-xl bg-muted/40 dark:bg-white/10 border border-border/60 px-4 py-2.5 text-sm outline-none focus:border-emerald-400/70 focus:ring-2 focus:ring-emerald-400/20 transition" />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-muted-foreground">Gender</label>
              <select value={form.gender} onChange={e=> setForm(f=>({...f, gender: e.target.value as any}))} className="w-full rounded-xl bg-muted/40 dark:bg-gray-900/60 border border-border/60 px-3 py-2.5 text-sm outline-none focus:border-emerald-400/70 focus:ring-2 focus:ring-emerald-400/20 transition text-foreground">
                <option value="">Select</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-[12px] font-medium text-muted-foreground">Date of Birth</label>
              <input type="date" value={form.dob} onChange={e=> setForm(f=>({...f, dob:e.target.value}))} className="w-full rounded-xl bg-muted/40 dark:bg-white/10 border border-border/60 px-4 py-2.5 text-sm outline-none focus:border-emerald-400/70 focus:ring-2 focus:ring-emerald-400/20 transition" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[12px] font-medium text-muted-foreground">Address</label>
              <input value={form.address} onChange={e=> setForm(f=>({...f, address:e.target.value}))} placeholder="Street, City, State" className="w-full rounded-xl bg-muted/40 dark:bg-white/10 border border-border/60 px-4 py-2.5 text-sm outline-none focus:border-emerald-400/70 focus:ring-2 focus:ring-emerald-400/20 transition" />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-muted-foreground">Patient Email</label>
              <input value={form.email} onChange={e=> setForm(f=>({...f, email:e.target.value}))} placeholder="name@example.com" className="w-full rounded-xl bg-muted/40 dark:bg-white/10 border border-border/60 px-4 py-2.5 text-sm outline-none focus:border-emerald-400/70 focus:ring-2 focus:ring-emerald-400/20 transition" />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-muted-foreground">Patient Phone</label>
              <input value={form.phone} onChange={e=> setForm(f=>({...f, phone:e.target.value}))} placeholder="+1 555-555-5555" className="w-full rounded-xl bg-muted/40 dark:bg-white/10 border border-border/60 px-4 py-2.5 text-sm outline-none focus:border-emerald-400/70 focus:ring-2 focus:ring-emerald-400/20 transition" />
            </div>
            <div className="sm:col-span-2 mt-2 text-[12px] font-semibold text-foreground/80">Emergency Contact</div>
            <div>
              <label className="block text-[12px] font-medium text-muted-foreground">Name</label>
              <input value={form.emergency_name} onChange={e=> setForm(f=>({...f, emergency_name:e.target.value}))} placeholder="Contact full name" className="w-full rounded-xl bg-muted/40 dark:bg-white/10 border border-border/60 px-4 py-2.5 text-sm outline-none focus:border-emerald-400/70 focus:ring-2 focus:ring-emerald-400/20 transition" />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-muted-foreground">Phone</label>
              <input value={form.emergency_phone} onChange={e=> setForm(f=>({...f, emergency_phone:e.target.value}))} placeholder="+1 555-555-5555" className="w-full rounded-xl bg-muted/40 dark:bg-white/10 border border-border/60 px-4 py-2.5 text-sm outline-none focus:border-emerald-400/70 focus:ring-2 focus:ring-emerald-400/20 transition" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[12px] font-medium text-muted-foreground">Email</label>
              <input value={form.emergency_email} onChange={e=> setForm(f=>({...f, emergency_email:e.target.value}))} placeholder="contact@example.com" className="w-full rounded-xl bg-muted/40 dark:bg-white/10 border border-border/60 px-4 py-2.5 text-sm outline-none focus:border-emerald-400/70 focus:ring-2 focus:ring-emerald-400/20 transition" />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-muted-foreground">Latitude</label>
              <input value={form.lat} onChange={e=> setForm(f=>({...f, lat:e.target.value}))} placeholder="12.9716" className="w-full rounded-xl bg-muted/40 dark:bg-white/10 border border-border/60 px-4 py-2.5 text-sm outline-none focus:border-emerald-400/70 focus:ring-2 focus:ring-emerald-400/20 transition" />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-muted-foreground">Longitude</label>
              <input value={form.lng} onChange={e=> setForm(f=>({...f, lng:e.target.value}))} placeholder="77.5946" className="w-full rounded-xl bg-muted/40 dark:bg-white/10 border border-border/60 px-4 py-2.5 text-sm outline-none focus:border-emerald-400/70 focus:ring-2 focus:ring-emerald-400/20 transition" />
            </div>
          </div>
          {error && <p className="mt-3 text-xs text-red-600 dark:text-red-300">{error}</p>}
          <div className="mt-6 flex items-center gap-3">
            <button type="button" onClick={()=> setShowMap(true)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-neutral-800/90 dark:bg-white/10 hover:bg-neutral-800 text-white dark:text-white text-sm font-medium px-5 py-2.5 border border-border/60">
              Show map
            </button>
            <button type="button" onClick={save} disabled={saving} className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 shadow">
              {saving ? 'Registering…' : 'Register Patient'}
            </button>
          </div>
        </section>
      </div>

      {/* Map Overlay */}
      <AnimatePresence>
        {showMap && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-[5000]">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={()=> setShowMap(false)} />
            <motion.div initial={{scale:0.96, opacity:0}} animate={{scale:1, opacity:1}} exit={{scale:0.96, opacity:0}} className="relative w-[94%] sm:w-[800px] h-[70vh] max-h-[700px] mx-auto mt-16 rounded-2xl bg-card border border-border shadow-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <h3 className="text-sm font-semibold">Select Coordinates</h3>
                <button onClick={()=> setShowMap(false)} className="text-xs rounded-lg px-2 py-1 bg-muted hover:bg-muted/80">Close</button>
              </div>
              <div ref={mapEl} className="w-full h-[calc(100%-48px)]" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>{toast && (
        <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} exit={{opacity:0,y:10}} className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[6000]">
          <div className="px-5 py-3 rounded-xl bg-emerald-600 text-white text-sm shadow-lg shadow-emerald-900/30 flex items-center gap-2">
            <span className="font-medium">{toast}</span>
          </div>
        </motion.div>)}
      </AnimatePresence>
    </div>
  );
}
