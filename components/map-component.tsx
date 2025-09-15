'use client';

import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, ZoomControl } from 'react-leaflet';
import { Icon, LatLngExpression } from 'leaflet';
import type { Map as LeafletMap } from 'leaflet';
import type { Marker as LeafletMarker } from 'leaflet';
import { ExternalLink } from 'lucide-react';
import { WellData } from '@/lib/well-data';
import { useTheme } from 'next-themes';
import 'leaflet/dist/leaflet.css';

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

interface MapComponentProps {
  wells: WellData[];
  selectedWell?: WellData;
  onWellSelect: (well: WellData) => void;
  highlightedWellIds?: string[];
}

export function MapComponent({ wells, selectedWell, onWellSelect, highlightedWellIds = [] }: MapComponentProps) {
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
    if (selectedWell && markerRefs[selectedWell.id]) {
      try { markerRefs[selectedWell.id]?.openPopup(); } catch {}
    }
  }, [selectedWell, markerRefs]);
  if (!mounted) {
    return <div className="w-full h-full flex items-center justify-center text-xs text-gray-500">Loading map...</div>;
  }


  const center: LatLngExpression = wells.length
    ? [wells[0].location.lat, wells[0].location.lng]
    : [15.488527857031876, 73.85236385002361];

  const createCustomIcon = (status: WellData['status'], highlighted: boolean) => {
    const colors = {
      active: '#22c55e',
      warning: '#f59e0b',
      critical: '#ef4444',
      offline: '#6b7280'
    } as const;
    const glow = highlighted ? `<circle cx='12.5' cy='12.5' r='11' fill='${colors[status]}' fill-opacity='0.15'/>` : '';
    const ring = highlighted ? `<circle cx='12.5' cy='12.5' r='8.5' stroke='${colors[status]}' stroke-width='2' fill='white'/>` : `<circle cx='12.5' cy='12.5' r='6' fill='white'/>`;
    const inner = highlighted ? `<circle cx='12.5' cy='12.5' r='4' fill='${colors[status]}'/>` : `<circle cx='12.5' cy='12.5' r='3' fill='${colors[status]}'/>`;
    const svgIcon = `\n      <svg width="25" height="41" viewBox="0 0 25 41" xmlns="http://www.w3.org/2000/svg">\n        <path d="M12.5 0C5.6 0 0 5.6 0 12.5c0 12.5 12.5 28.5 12.5 28.5S25 25 25 12.5C25 5.6 19.4 0 12.5 0z" fill="${colors[status]}"/>\n        ${glow}\n        ${ring}\n        ${inner}\n      </svg>\n    `;
    return new Icon({
      iconUrl: `data:image/svg+xml;base64,${btoa(svgIcon)}`,
      iconSize: [25, 41],
      iconAnchor: [12.5, 41],
      popupAnchor: [0, -41],
    });
  };

  return (
    <MapContainer
      id="ecowell-map"
      whenReady={() => {
        // Access the map instance via the internal leaflet_id on the container element
        try {
          const el = document.getElementById('ecowell-map') as any;
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
      {selectedWell && <MapFlyTo well={selectedWell} />}
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
    {wells.map((well) => (
        <Marker
          key={well.id}
          position={[well.location.lat, well.location.lng]}
      icon={createCustomIcon(well.status, highlightedWellIds.includes(well.id))}
          ref={(ref) => { if (ref) markerRefs[well.id] = ref; }}
          eventHandlers={{ click: () => onWellSelect(well) }}
        >
          <Popup className="well-popup">
            <div className="p-3 min-w-[220px] space-y-2 font-sans rounded-lg">
              <div className="flex items-start justify-between gap-4">
                <h3 className="font-semibold text-foreground leading-snug text-sm">{well.name}</h3>
                <span className={`shrink-0 px-2 py-0.5 rounded-md text-[10px] font-semibold tracking-wide backdrop-blur-sm ${
                  well.status === 'active' ? 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-400/30' :
                  well.status === 'warning' ? 'bg-amber-500/15 text-amber-400 ring-1 ring-amber-400/30' :
                  well.status === 'critical' ? 'bg-red-500/15 text-red-400 ring-1 ring-red-400/30' :
                  'bg-muted/60 text-muted-foreground ring-1 ring-border/40'
                }`}>{well.status.toUpperCase()}</span>
              </div>
              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between"><span className="text-muted-foreground">Village</span><span className="font-medium text-foreground truncate max-w-[120px] text-right">{well.village || '—'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Panchayat</span><span className="font-medium text-foreground truncate max-w-[120px] text-right">{well.panchayatName || '—'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Contact</span><span className="font-medium text-foreground text-right">{well.contactNumber || '—'}</span></div>
                <div className="flex justify-between pt-1 border-t border-border/40"><span className="text-muted-foreground">TDS</span><span className="font-medium text-foreground">{Math.round(well.data.tds)} ppm</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Temp</span><span className="font-medium text-foreground">{well.data.temperature.toFixed(1)}°C</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Water Level</span><span className="font-medium text-foreground">{well.data.waterLevel.toFixed(1)} m</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">pH Level</span><span className="font-medium text-foreground">{well.data.ph.toFixed(2)}</span></div>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">Updated {well.data.lastUpdated.toLocaleTimeString()}</p>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${well.location.lat},${well.location.lng}`}
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

// Component to animate map view when selectedWell changes
function MapFlyTo({ well }: { well: WellData }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([well.location.lat, well.location.lng], 15, { duration: 1.2, easeLinearity: 0.25 });
  }, [well, map]);
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