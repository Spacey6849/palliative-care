"use client";
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { PatientWithStatus } from '@/lib/patient-types';
import { PatientPopup } from './patient-popup';

// Build a colored marker icon using SVG data URI
function buildIcon(color: string) {
  const svg = encodeURIComponent(`
    <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'>
      <path fill='${color}' d='M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z'/>
    </svg>`);
  return L.icon({
    iconUrl: `data:image/svg+xml;charset=UTF-8,${svg}`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -28]
  });
}

const ICONS = {
  normal: buildIcon('#10b981'), // emerald-500
  warning: buildIcon('#f59e0b'), // amber-500
  critical: buildIcon('#ef4444') // red-500
};

export default function PatientMap() {
  const [patients, setPatients] = useState<PatientWithStatus[]>([]);
  const mapRef = useRef<L.Map | null>(null);

  const center = useMemo(() => ({ lat: 0.5, lng: 20 }), []);

  async function load() {
    try {
      const res = await fetch('/api/patients', { cache: 'no-store' });
      const json = await res.json();
      setPatients(json.patients || []);
    } catch {}
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, []);

  const handleAck = async (id: string) => {
    try { await fetch(`/api/patients/${id}/alert`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ emergency: false }) }); load(); } catch {}
  };
  const handleEmergency = async (id: string) => {
    try { await fetch(`/api/patients/${id}/alert`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ emergency: true }) }); load(); } catch {}
  };

  return (
    <div className="w-full h-[calc(100vh-80px)]">
  <MapContainer id="pcare-map" center={center} zoom={3} style={{ width: '100%', height: '100%' }} whenReady={() => { /* map ref is set by React Leaflet context on child events if needed */ }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {patients.map(p => (
          <Marker key={p.id} position={{ lat: p.lat, lng: p.lng }} icon={ICONS[p.status] || ICONS.normal}>
            <Popup>
              <PatientPopup p={p} onAcknowledge={() => handleAck(p.id)} onEmergency={() => handleEmergency(p.id)} />
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
