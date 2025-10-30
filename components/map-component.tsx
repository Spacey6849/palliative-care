'use client';

import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, ZoomControl } from 'react-leaflet';
import { Icon, LatLngExpression } from 'leaflet';
import type { Map as LeafletMap } from 'leaflet';
import type { Marker as LeafletMarker } from 'leaflet';
import { ExternalLink, Heart, Activity } from 'lucide-react';
import { useUser } from '@/components/user-context';
import { useTheme } from 'next-themes';

// Fix for default markers in react-leaflet (apply once in browser to avoid Fast Refresh duplication)
if (typeof window !== 'undefined' && !(window as any)._leafletDefaultIconPatched) {
  try {
    delete (Icon.Default.prototype as any)._getIconUrl;
    Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
      iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    });
    (window as any)._leafletDefaultIconPatched = true;
  } catch (e) {
    // silent fallthrough
  }
}

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

interface MapComponentProps {
  patients: PatientData[];
  selectedPatient?: PatientData;
  onPatientSelect: (patient: PatientData) => void;
  highlightedPatientIds?: string[];
}

export function MapComponent({ patients, selectedPatient, onPatientSelect, highlightedPatientIds = [] }: MapComponentProps) {
  const { role } = useUser();
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const markerRefs = useState<Record<string, LeafletMarker | null>>({})[0];
  // Ref to underlying Leaflet map instance
  const mapRef = useRef<LeafletMap | null>(null);
  // Ensure cleanup on unmount to avoid container reuse errors
  useEffect(() => {
    return () => {
      try {
        if (mapRef.current) {
          mapRef.current.remove();
          mapRef.current = null;
        }
      } catch {}
    };
  }, []);

  useEffect(() => { setMounted(true); }, []);
  // Auto-open popup when selection changes (e.g., via search selection)
  useEffect(() => {
    if (selectedPatient && markerRefs[selectedPatient.id]) {
      try { markerRefs[selectedPatient.id]?.openPopup(); } catch {}
    }
  }, [selectedPatient, markerRefs]);
  if (!mounted) {
    return <div className="w-full h-full flex items-center justify-center text-xs text-gray-500">Loading map...</div>;
  }


  const center: LatLngExpression = patients.length
    ? [patients[0].lat, patients[0].lng]
    : [15.488527857031876, 73.85236385002361];

  const createCustomIcon = (status: PatientData['status'], highlighted: boolean, emergency: boolean) => {
    const colors = {
      normal: '#22c55e',
      warning: '#f59e0b',
      critical: '#ef4444',
      emergency: '#dc2626'
    } as const;
    const color = emergency ? colors.emergency : colors[status];
    const glow = highlighted ? `<circle cx='12.5' cy='12.5' r='11' fill='${color}' fill-opacity='0.15'/>` : '';
    const criticalGlow = (status === 'critical' || status === 'emergency' || emergency) ? `<circle cx='12.5' cy='12.5' r='12.5' fill='${color}' fill-opacity='0.18'/>` : '';
    const ring = highlighted ? `<circle cx='12.5' cy='12.5' r='8.5' stroke='${color}' stroke-width='2' fill='white'/>` : `<circle cx='12.5' cy='12.5' r='6' fill='white'/>`;
    const inner = highlighted ? `<circle cx='12.5' cy='12.5' r='4' fill='${color}'/>` : `<circle cx='12.5' cy='12.5' r='3' fill='${color}'/>`;
    const svgIcon = `\n      <svg width="25" height="41" viewBox="0 0 25 41" xmlns="http://www.w3.org/2000/svg">\n        <path d="M12.5 0C5.6 0 0 5.6 0 12.5c0 12.5 12.5 28.5 12.5 28.5S25 25 25 12.5C25 5.6 19.4 0 12.5 0z" fill="${color}"/>\n        ${criticalGlow}\n        ${glow}\n        ${ring}\n        ${inner}\n      </svg>\n    `;
    return new Icon({
      iconUrl: `data:image/svg+xml;base64,${btoa(svgIcon)}`,
      iconSize: [25, 41],
      iconAnchor: [12.5, 41],
      popupAnchor: [0, -41],
    });
  };

  return (
    <MapContainer
  id="pcare-map"
      whenReady={() => {
        // Access the map instance via the internal leaflet_id on the container element
        try {
          const el = document.getElementById('pcare-map') as any;
          if (el && el._leaflet_id && (window as any).L) {
            // The global Leaflet stores maps in an internal registry; safest is to store via mapRef when first marker opens
            // Fallback: assign via any available _leaflet_map property (not public API, but acceptable for dev cleanup)
            mapRef.current = el._leaflet_map || mapRef.current;
          }
        } catch {}
      }}
      center={center}
      zoom={13}
      zoomControl={false}
      className="w-full h-full rounded-lg z-0 pt-[70px] sm:pt-0"
      style={{ background: theme === 'dark' ? '#1f2937' : '#f3f4f6' }}
    >
      <ZoomControl position="bottomright" />
      {selectedPatient && <MapFlyTo patient={selectedPatient} />}
      <PopupOffset />
      <TileLayer
        url={(function(){
          const stadiaKey = (process.env as any)['NEXT_PUBLIC_STADIA_API_KEY'];
          if (theme === 'dark') {
            if (stadiaKey) {
              return `https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png?api_key=${stadiaKey}`;
            }
            // Fallback dark basemap (Carto Dark Matter, no key required)
            return 'https://cartodb-basemaps-{s}.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png';
          }
          return 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
        })()}
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="https://stadiamaps.com/">Stadia Maps</a>, &copy; <a href="https://carto.com/attributions">CARTO</a>'
      />
      {patients.map((patient) => (
        <Marker
          key={patient.id}
          position={[patient.lat, patient.lng]}
          icon={createCustomIcon(patient.status, highlightedPatientIds.includes(patient.id), patient.emergency || patient.fall_detected)}
          ref={(ref) => { if (ref) markerRefs[patient.id] = ref; }}
          eventHandlers={{ click: () => onPatientSelect(patient) }}
        >
          <Popup className="patient-popup">
            <div className="p-3 min-w-[220px] space-y-2 font-sans rounded-lg">
              <div className="flex items-start justify-between gap-4">
                <h3 className="font-semibold text-foreground leading-snug text-sm flex items-center gap-2">
                  <Heart className="h-4 w-4 text-red-500" />
                  <span>{patient.full_name}</span>
                </h3>
                <span className={`shrink-0 px-2 py-0.5 rounded-md text-[10px] font-semibold tracking-wide backdrop-blur-sm ${
                  patient.emergency || patient.status === 'emergency' ? 'bg-red-500/25 text-red-400 ring-1 ring-red-400/50 animate-pulse' :
                  patient.status === 'critical' ? 'bg-red-500/15 text-red-400 ring-1 ring-red-400/30' :
                  patient.status === 'warning' ? 'bg-yellow-500/15 text-yellow-400 ring-1 ring-yellow-400/30' :
                  'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-400/30'
                }`}>{patient.emergency || patient.status === 'emergency' ? 'EMERGENCY' : patient.status.toUpperCase()}</span>
              </div>
              <div className="space-y-1 text-[11px]">
                {patient.heart_rate !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground flex items-center gap-1"><Activity className="h-3 w-3" />Heart Rate</span>
                    <span className="font-medium text-foreground text-right">{patient.heart_rate} bpm</span>
                  </div>
                )}
                {patient.spo2 !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">SpO₂</span>
                    <span className="font-medium text-foreground text-right">{patient.spo2}%</span>
                  </div>
                )}
                {patient.body_temp !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Body Temp</span>
                    <span className="font-medium text-foreground text-right">{patient.body_temp}°C</span>
                  </div>
                )}
                {patient.fall_detected && (
                  <div className="flex justify-between">
                    <span className="text-red-500 font-semibold">⚠ Fall Detected</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <span className="font-medium text-foreground text-right">{patient.status.toUpperCase()}</span>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">Updated {new Date(patient.last_updated).toLocaleTimeString()}</p>
              {(patient.emergency || patient.status === 'emergency' || patient.fall_detected) && (
                <p className="text-[10px] text-red-500 font-medium">⚠ Immediate attention required!</p>
              )}
              {patient.status === 'critical' && !patient.emergency && (
                <p className="text-[10px] text-red-500 font-medium">High priority monitoring</p>
              )}
              {patient.status === 'normal' && (
                <p className="text-[10px] text-muted-foreground">Stable. Monitoring ongoing.</p>
              )}
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${patient.lat},${patient.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="group w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 hover:bg-primary/15 text-primary dark:text-primary text-[11px] font-medium tracking-wide px-3 py-1.5 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1 focus-visible:ring-offset-background transition-colors disabled:opacity-60 disabled:cursor-not-allowed no-underline"
              >
                <ExternalLink className="h-3.5 w-3.5 opacity-90 group-hover:opacity-100 transition-opacity" />
                <span className="">Open in Google Maps</span>
              </a>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}

// Component to animate map view when selectedPatient changes
function MapFlyTo({ patient }: { patient: PatientData }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([patient.lat, patient.lng], 15, { duration: 1.2, easeLinearity: 0.25 });
  }, [patient, map]);
  return null;
}

// Ensure popups aren't obscured by fixed navbar on mobile by auto-panning when too high
function PopupOffset() {
  const map = useMap();
  useEffect(() => {
    const handler = (e: any) => {
      if (typeof window === 'undefined') return;
      if (window.innerWidth >= 640) return; // only mobile
      try {
        const popup = e.popup;
        const pt = map.latLngToContainerPoint(popup.getLatLng());
        const minY = 120; // desired minimum y position for popup top area
        if (pt.y < minY) {
          const diff = minY - pt.y;
            map.panBy([0, diff], { animate: true });
        }
      } catch {}
    };
    map.on('popupopen', handler);
    return () => { map.off('popupopen', handler); };
  }, [map]);
  return null;
}