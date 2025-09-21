"use client";

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Sidebar } from '@/components/sidebar';
import { BinData } from '@/lib/bin-data';
import { motion } from 'framer-motion';
import { useUser } from '@/components/user-context';
import { getSupabase } from '@/lib/supabase/client';

const MapComponent = dynamic(
  () => import('@/components/map-component').then(mod => mod.MapComponent),
  { ssr: false, loading: () => <div className="w-full h-full bg-gray-100 dark:bg-gray-900 rounded-lg flex items-center justify-center"><div className="text-gray-500 dark:text-gray-400">Loading map...</div></div> }
);

export default function MapsPage() {
  const [bins, setBins] = useState<BinData[]>([]);
  const [selectedBin, setSelectedBin] = useState<BinData | undefined>();
  const [highlightedIds, setHighlightedIds] = useState<string[]>([]);
  const { user, role } = useUser();
  const supabase = getSupabase();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) {
        // Guest: use locally saved customBins, transform to WellData shape
        const transform = (bin: any): BinData => {
          const fill = typeof bin?.data?.fill_pct === 'number' ? Math.max(0, Math.min(100, Number(bin.data.fill_pct))) : null;
          const tds = fill == null ? 360 : 200 + (fill / 100) * 600; // inverse mapping to align with existing UI
          const offline = (bin?.status || '').toLowerCase() === 'offline';
          const isOpen = typeof bin?.data?.is_open === 'boolean' ? bin.data.is_open : false;
          const inferredStatus: BinData['status'] = offline ? 'offline' : (fill != null && fill >= 95 ? 'critical' : (isOpen ? 'warning' : 'active'));
          return {
            id: bin.id,
            name: bin.name,
            label: bin.location_label || undefined,
            location: { lat: Number(bin.location?.lat), lng: Number(bin.location?.lng) },
            status: inferredStatus,
            data: {
              tds: tds,
              lastUpdated: bin.data?.lastUpdated ? new Date(bin.data.lastUpdated) : new Date(),
            },
            history: [],
          };
        };
        let initial: BinData[] = [];
        try {
          const stored = localStorage.getItem('customBins');
          if (stored) {
            const parsed = JSON.parse(stored) as any[];
            initial = parsed.map(transform);
          }
        } catch {}
        if (!cancelled) { setBins(initial); setSelectedBin(initial[0]); }
        return;
      }
      // Authenticated: Fetch bins from API and transform to WellData shape
      try {
        const resp = await fetch('/api/bins', { cache: 'no-store' });
        if (resp.ok) {
          const j = await resp.json();
          const transformed: BinData[] = (j.bins || []).map((row: any) => {
            const fill = typeof row.fill_pct === 'number' ? Math.max(0, Math.min(100, Number(row.fill_pct))) : null;
            const tds = fill == null ? 360 : 200 + (fill / 100) * 600;
            const offline = (row.status || '').toLowerCase() === 'offline';
            const isOpen = typeof row.is_open === 'boolean' ? row.is_open : null;
            const inferredStatus: BinData['status'] = offline ? 'offline' : (fill != null && fill >= 95 ? 'critical' : (isOpen ? 'warning' : 'active'));
            return {
              id: row.id,
              name: row.name,
              label: row.label || undefined,
              bin_type: row.bin_type || null,
              location: { lat: Number(row.location?.lat ?? row.lat), lng: Number(row.location?.lng ?? row.lng) },
              fill_pct: fill,
              is_open: isOpen,
              updated_at: row.updated_at ? new Date(row.updated_at) : undefined,
              status: inferredStatus,
              data: {
                tds: fill == null ? tds : undefined,
                lastUpdated: row.updated_at ? new Date(row.updated_at) : new Date(),
              },
              history: [],
            } as BinData;
          });
          if (!cancelled) { setBins(transformed); setSelectedBin(transformed[0]); }
        }
      } catch (e) {
        console.warn('Failed loading bins API');
        if (!cancelled) { setBins([] as BinData[]); setSelectedBin(undefined); }
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, role]);

  // Removed demo jitter updates

  // Realtime soft updates: merge incoming bin_metrics into state (no full reload)
  useEffect(() => {
    if (!user) return; // only subscribe for authenticated users fetching real bins

    const channel = supabase
      .channel('public:bin_metrics')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bin_metrics' },
        (payload: any) => {
          const rec = payload?.new ?? payload?.record ?? payload;
          if (!rec) return;

          const fill = typeof rec.fill_pct === 'number' ? Math.max(0, Math.min(100, Number(rec.fill_pct))) : null;
          const isOpen = typeof rec.is_open === 'boolean' ? rec.is_open : undefined;
          const updatedAt: Date | undefined = rec.recorded_at
            ? new Date(rec.recorded_at)
            : rec.updated_at
            ? new Date(rec.updated_at)
            : undefined;

          // Update list of bins
          setBins((prev) =>
            prev.map((b) => {
              const match = (b.id && rec.bin_id && b.id === rec.bin_id) || (b.name && rec.bin_name && b.name === rec.bin_name);
              if (!match) return b;
              const nextFill = fill ?? b.fill_pct ?? null;
              const nextIsOpen = typeof isOpen === 'boolean' ? isOpen : (typeof b.is_open === 'boolean' ? b.is_open : null);
              const nextStatus: BinData['status'] = b.status === 'offline'
                ? 'offline'
                : (nextFill != null && nextFill >= 95)
                ? 'critical'
                : (nextIsOpen ? 'warning' : 'active');
              return {
                ...b,
                fill_pct: nextFill ?? undefined,
                is_open: typeof nextIsOpen === 'boolean' ? nextIsOpen : undefined,
                updated_at: updatedAt ?? b.updated_at,
                status: nextStatus,
                // Keep legacy data.tds only if there is no fill_pct; otherwise prefer live %
                data: {
                  ...b.data,
                  tds: nextFill == null ? b.data?.tds : undefined,
                  lastUpdated: updatedAt ?? b.data?.lastUpdated ?? new Date(),
                },
              } as BinData;
            })
          );

          // Update selected bin card/popup if relevant
          setSelectedBin((prev) => {
            if (!prev) return prev;
            const match = (prev.id && rec.bin_id && prev.id === rec.bin_id) || (prev.name && rec.bin_name && prev.name === rec.bin_name);
            if (!match) return prev;
            const nextFill = fill ?? prev.fill_pct ?? null;
            const nextIsOpen = typeof isOpen === 'boolean' ? isOpen : (typeof prev.is_open === 'boolean' ? prev.is_open : null);
            const nextStatus: BinData['status'] = prev.status === 'offline'
              ? 'offline'
              : (nextFill != null && nextFill >= 95)
              ? 'critical'
              : (nextIsOpen ? 'warning' : 'active');
            return {
              ...prev,
              fill_pct: nextFill ?? undefined,
              is_open: typeof nextIsOpen === 'boolean' ? nextIsOpen : undefined,
              updated_at: updatedAt ?? prev.updated_at,
              status: nextStatus,
              data: {
                ...prev.data,
                tds: nextFill == null ? prev.data?.tds : undefined,
                lastUpdated: updatedAt ?? prev.data?.lastUpdated ?? new Date(),
              },
            } as BinData;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return (
    <div className="h-screen w-full overflow-hidden bg-gradient-to-br from-blue-50 via-white to-cyan-50 dark:from-gray-950 dark:via-gray-900 dark:to-slate-900 relative">
      <div className="absolute inset-0">
        <MapComponent
          bins={bins}
          selectedBin={selectedBin}
          onBinSelect={setSelectedBin}
          highlightedBinIds={highlightedIds}
        />
      </div>
      {selectedBin && (
        <motion.div className="absolute top-[86px] sm:top-6 right-3 sm:right-6 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl rounded-xl p-3 sm:p-4 shadow-xl border border-gray-200/60 dark:border-gray-700/60 z-30 w-56 sm:w-auto max-w-[320px]" initial={{opacity:0,y:-20}} animate={{opacity:1,y:0}} transition={{duration:0.3}}>
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">{selectedBin.name}</h3>
          {selectedBin.bin_type && (
            <div className="text-[11px] text-gray-600 dark:text-gray-400 mb-1">Type: {String(selectedBin.bin_type).toUpperCase()}</div>
          )}
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${selectedBin.status === 'offline' ? 'bg-gray-500' : selectedBin.status === 'critical' ? 'bg-red-500' : selectedBin.status === 'warning' ? 'bg-yellow-500' : 'bg-green-500'}`} />
            <span className={`text-sm font-medium ${selectedBin.status === 'offline' ? 'text-gray-600 dark:text-gray-400' : selectedBin.status === 'critical' ? 'text-red-600 dark:text-red-400' : selectedBin.status === 'warning' ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600 dark:text-green-400'}`}>
              {selectedBin.status === 'offline' ? 'Offline' : 'Online'}
            </span>
          </div>
        </motion.div>
      )}
      <div className="absolute top-0 left-0 h-full z-40">
        <Sidebar
          bins={bins}
          selectedBin={selectedBin}
          onBinSelect={setSelectedBin}
          onSearchHighlightChange={setHighlightedIds}
        />
      </div>
    </div>
  );
}