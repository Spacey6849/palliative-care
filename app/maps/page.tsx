"use client";

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Sidebar } from '@/components/sidebar';
import { motion } from 'framer-motion';
import { useUser } from '@/components/user-context';
import { getSupabase } from '@/lib/supabase/client';

const MapComponent = dynamic(
  () => import('@/components/map-component').then(mod => mod.MapComponent),
  { ssr: false, loading: () => <div className="w-full h-full bg-gray-100 dark:bg-gray-900 rounded-lg flex items-center justify-center"><div className="text-gray-500 dark:text-gray-400">Loading map...</div></div> }
);

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

export default function MapsPage() {
  const [patients, setPatients] = useState<PatientData[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<PatientData | undefined>();
  // Incremented only on explicit user selections; used to gate map fly/popup so polling doesn't jitter the map
  const [selectionTick, setSelectionTick] = useState(0);
  const [highlightedIds, setHighlightedIds] = useState<string[]>([]);
  const { user, role } = useUser();
  const supabase = getSupabase();

  // Fetch patients from API
  useEffect(() => {
    let cancelled = false;
    const fetchPatients = async () => {
      try {
        const resp = await fetch('/api/patients', { cache: 'no-store' });
        if (resp.ok) {
          const j = await resp.json();
          if (!cancelled) {
            setPatients(j.patients || []);
            if (!selectedPatient && j.patients?.length > 0) {
              // Seed initial selection without triggering map fly/popup
              setSelectedPatient(j.patients[0]);
            }
          }
        }
      } catch (e) {
        console.warn('Failed loading patients API');
        if (!cancelled) setPatients([]);
      }
    };

    fetchPatients();
    // Poll every 5 seconds for updates
    const interval = setInterval(fetchPatients, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Realtime updates for patient_vitals
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('public:patient_vitals')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'patient_vitals' },
        () => {
          // Refetch patients to get updated vitals
          fetch('/api/patients', { cache: 'no-store' })
            .then(resp => resp.json())
            .then(j => {
              setPatients(j.patients || []);
              // Update selected patient if it matches
              if (selectedPatient) {
                const updated = (j.patients || []).find((p: PatientData) => p.id === selectedPatient.id);
                if (updated) setSelectedPatient(updated); // don't bump selectionTick here
              }
            })
            .catch(() => {});
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, selectedPatient?.id]);

  // Ensure only user-initiated selection triggers map fly/popup
  const handlePatientSelect = (p: PatientData) => {
    setSelectedPatient(p);
    setSelectionTick((t) => t + 1);
  };

  return (
    <div className="h-screen w-full overflow-hidden bg-gradient-to-br from-blue-50 via-white to-cyan-50 dark:from-gray-950 dark:via-gray-900 dark:to-slate-900 relative">
      <div className="absolute inset-0">
        <MapComponent
          patients={patients}
          selectedPatient={selectedPatient}
          selectionTick={selectionTick}
          onPatientSelect={handlePatientSelect}
          highlightedPatientIds={highlightedIds}
        />
      </div>
      {selectedPatient && (
        <motion.div className="absolute top-[86px] sm:top-6 right-3 sm:right-6 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl rounded-xl p-3 sm:p-4 shadow-xl border border-gray-200/60 dark:border-gray-700/60 z-30 w-56 sm:w-auto max-w-[320px]" initial={{opacity:0,y:-20}} animate={{opacity:1,y:0}} transition={{duration:0.3}}>
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">{selectedPatient.full_name}</h3>
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${selectedPatient.status === 'emergency' || selectedPatient.emergency ? 'bg-red-500 animate-pulse' : selectedPatient.status === 'critical' ? 'bg-red-500' : selectedPatient.status === 'warning' ? 'bg-yellow-500' : 'bg-green-500'}`} />
            <span className={`text-sm font-medium ${selectedPatient.status === 'emergency' || selectedPatient.emergency ? 'text-red-600 dark:text-red-400' : selectedPatient.status === 'critical' ? 'text-red-600 dark:text-red-400' : selectedPatient.status === 'warning' ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600 dark:text-green-400'}`}>
              {selectedPatient.status === 'emergency' || selectedPatient.emergency ? 'EMERGENCY' : selectedPatient.status.toUpperCase()}
            </span>
          </div>
        </motion.div>
      )}
      <div className="absolute top-0 left-0 h-full z-40">
        <Sidebar
          patients={patients}
          selectedPatient={selectedPatient}
          onPatientSelect={handlePatientSelect}
          onSearchHighlightChange={setHighlightedIds}
        />
      </div>
    </div>
  );
}