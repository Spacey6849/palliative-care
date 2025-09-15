"use client";

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Sidebar } from '@/components/sidebar';
import { mockWellData, WellData } from '@/lib/well-data';
import { motion } from 'framer-motion';
import { useUser } from '@/components/user-context';

const MapComponent = dynamic(
  () => import('@/components/map-component').then(mod => mod.MapComponent),
  { ssr: false, loading: () => <div className="w-full h-full bg-gray-100 dark:bg-gray-900 rounded-lg flex items-center justify-center"><div className="text-gray-500 dark:text-gray-400">Loading map...</div></div> }
);

export default function MapsPage() {
  const [wells, setWells] = useState<WellData[]>([]);
  const [selectedWell, setSelectedWell] = useState<WellData | undefined>();
  const [highlightedIds, setHighlightedIds] = useState<string[]>([]);
  const { user, role } = useUser();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) {
        // Guest: mock + local custom
        let initial = [...mockWellData];
        try {
          const stored = localStorage.getItem('customWells');
          if (stored) {
            const parsed = JSON.parse(stored) as WellData[];
            parsed.forEach(w => { w.data.lastUpdated = new Date(w.data.lastUpdated); w.history.forEach(h => h.timestamp = new Date(h.timestamp)); });
            initial = [...initial, ...parsed];
          }
        } catch {}
        if (!cancelled) { setWells(initial); setSelectedWell(initial[0]); }
        return;
      }
      // Authenticated: (Placeholder) Fetch wells from future MySQL endpoint
      try {
        const resp = await fetch('/api/wells', { cache: 'no-store' });
        if (resp.ok) {
          const j = await resp.json();
          const transformed: WellData[] = (j.wells || []).map((row: any) => ({
            id: row.id,
            name: row.name,
            village: row.location || undefined,
            panchayatName: row.panchayat_name || undefined,
            contactNumber: row.phone || undefined,
            location: { lat: row.lat, lng: row.lng },
            status: row.status || 'active',
            data: { 
              ph: row.ph != null ? Number(row.ph) : 7.2, 
              tds: row.tds != null ? Number(row.tds) : 360, 
              temperature: row.temperature != null ? Number(row.temperature) : 26.1, 
              waterLevel: row.water_level != null ? Number(row.water_level) : 42, 
              lastUpdated: row.last_ts ? new Date(row.last_ts) : new Date() 
            },
            history: []
          }));
          if (!cancelled) { setWells(transformed); setSelectedWell(transformed[0]); }
        }
      } catch (e) {
        console.warn('Failed loading wells API, falling back to mock');
        if (!cancelled) {
          setWells(mockWellData); setSelectedWell(mockWellData[0]);
        }
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, role]);

  useEffect(() => {
    const interval = setInterval(() => {
      setWells(current => current.map(well => ({
        ...well,
        data: {
          ...well.data,
          ph: Math.max(5, Math.min(9, well.data.ph + (Math.random() - 0.5) * 0.1)),
          tds: Math.max(200, Math.min(800, well.data.tds + (Math.random() - 0.5) * 10)),
          temperature: Math.max(10, Math.min(35, well.data.temperature + (Math.random() - 0.5) * 0.5)),
          waterLevel: Math.max(20, Math.min(70, well.data.waterLevel + (Math.random() - 0.5) * 1)),
          lastUpdated: new Date(),
        }
      })));
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-screen w-full overflow-hidden bg-gradient-to-br from-blue-50 via-white to-cyan-50 dark:from-gray-950 dark:via-gray-900 dark:to-slate-900 relative">
      <div className="absolute inset-0">
        <MapComponent
          wells={wells}
            selectedWell={selectedWell}
            onWellSelect={setSelectedWell}
            highlightedWellIds={highlightedIds}
        />
      </div>
      {selectedWell && (
        <motion.div className="absolute top-[86px] sm:top-6 right-3 sm:right-6 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl rounded-xl p-3 sm:p-4 shadow-xl border border-gray-200/60 dark:border-gray-700/60 z-30 w-56 sm:w-auto max-w-[320px]" initial={{opacity:0,y:-20}} animate={{opacity:1,y:0}} transition={{duration:0.3}}>
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">{selectedWell.name}</h3>
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${selectedWell.status === 'active' ? 'bg-green-500' : selectedWell.status === 'warning' ? 'bg-yellow-500' : selectedWell.status === 'critical' ? 'bg-red-500' : 'bg-gray-500'}`} />
            <span className={`text-sm font-medium ${selectedWell.status === 'active' ? 'text-green-600 dark:text-green-400' : selectedWell.status === 'warning' ? 'text-yellow-600 dark:text-yellow-400' : selectedWell.status === 'critical' ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'}`}>{selectedWell.status.toUpperCase()}</span>
          </div>
        </motion.div>
      )}
      <div className="absolute top-0 left-0 h-full z-40">
        <Sidebar
          wells={wells}
          selectedWell={selectedWell}
          onWellSelect={setSelectedWell}
          onSearchHighlightChange={setHighlightedIds}
        />
      </div>
    </div>
  );
}