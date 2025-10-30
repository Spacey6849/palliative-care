"use client";
import LiquidEther from '@/components/LiquidEther';
import { useUser } from '@/components/user-context';
import React from 'react';

// Extracted client component for /home to ensure Netlify/Next never mis-classifies the route page file.
export function HomeClient() {
  const { user, role } = useUser();
  const isAuthed = !!user || !!role;
  return (
    <div className="relative min-h-screen">
      {/* background container - absolute, behind content (full viewport) */}
      <div style={{ width: '100%', height: '100vh', position: 'absolute', top: 0, left: 0 }}>
        <LiquidEther
          colors={[ '#5227FF', '#FF9FFC', '#B19EEF' ]}
          mouseForce={20}
          cursorSize={100}
          isViscous={false}
          viscous={30}
          iterationsViscous={32}
          iterationsPoisson={32}
          resolution={0.5}
          isBounce={false}
          autoDemo={true}
          autoSpeed={0.5}
          autoIntensity={2.2}
          takeoverDuration={0.25}
          autoResumeDelay={3000}
          autoRampDuration={0.6}
        />
      </div>
      <section className="relative z-10 px-6 sm:px-8 pt-28 sm:pt-36 pb-16 max-w-5xl mx-auto min-h-screen flex flex-col justify-start">
        <header className="text-center mb-10">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 bg-clip-text text-transparent">Palliative Care Monitoring</h1>
          <p className="mt-3 text-gray-600 dark:text-gray-300 text-base sm:text-lg">Real-time remote monitoring for patient vitals, alerts, and geolocation—built for caregivers and clinicians.</p>
        </header>
        <div className="grid sm:grid-cols-2 gap-5">
          <div className="rounded-2xl border p-5 bg-white/70 dark:bg-neutral-900/60 backdrop-blur-sm">
            <h2 className="text-lg font-semibold">How it works</h2>
            <ul className="mt-3 list-disc list-inside text-sm text-gray-600 dark:text-gray-300 space-y-1">
              <li>ESP32 streams vitals from MAX30102, DS18B20, DHT11, AD8232, and MPU6050.</li>
              <li>Cloud backend stores and aggregates telemetry with REST APIs.</li>
              <li>App shows patient locations on a live Leaflet map with status colors.</li>
              <li>Automated alerts for SpO2 &lt; 90%, HR out-of-range, and falls.</li>
            </ul>
          </div>
          <div className="rounded-2xl border p-5 bg-white/70 dark:bg-neutral-900/60 backdrop-blur-sm">
            <h2 className="text-lg font-semibold">Key features</h2>
            <ul className="mt-3 list-disc list-inside text-sm text-gray-600 dark:text-gray-300 space-y-1">
              <li>Vitals: heart rate, SpO2, body temp, room temp/humidity, ECG, fall detection.</li>
              <li>Geospatial tracking with clickable markers and real-time status.</li>
              <li>Historical trends and analytics for proactive care.</li>
              <li>Role-based access, alerts history, and CSV export.</li>
            </ul>
          </div>
        </div>
        <div className="mt-8 flex flex-wrap items-center gap-3 justify-center">
          <a href="/maps" className="inline-flex items-center px-5 py-3 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500">Open Patient Map</a>
          {!isAuthed && (
            <>
              <a href="/auth?mode=signup" className="inline-flex items-center px-5 py-3 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-500">Create Account</a>
              <a href="/auth?mode=login" className="inline-flex items-center px-5 py-3 rounded-xl border text-sm font-medium">Sign In</a>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
