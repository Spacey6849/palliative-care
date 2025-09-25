'use client';

import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, ZoomControl } from 'react-leaflet';
import { Icon, LatLngExpression } from 'leaflet';
import type { Map as LeafletMap } from 'leaflet';
import type { Marker as LeafletMarker } from 'leaflet';
import { ExternalLink } from 'lucide-react';
import { useUser } from '@/components/user-context';
import { BinData } from '@/lib/bin-data';
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

interface MapComponentProps {
  bins: BinData[];
  selectedBin?: BinData;
  onBinSelect: (bin: BinData) => void;
  highlightedBinIds?: string[];
}

export function MapComponent({ bins, selectedBin, onBinSelect, highlightedBinIds = [] }: MapComponentProps) {
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
    if (selectedBin && markerRefs[selectedBin.id]) {
      try { markerRefs[selectedBin.id]?.openPopup(); } catch {}
    }
  }, [selectedBin, markerRefs]);
  if (!mounted) {
    return <div className="w-full h-full flex items-center justify-center text-xs text-gray-500">Loading map...</div>;
  }


  const center: LatLngExpression = bins.length
    ? [bins[0].location.lat, bins[0].location.lng]
    : [15.488527857031876, 73.85236385002361];

  const createCustomIcon = (status: BinData['status'], highlighted: boolean) => {
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
      id="binlink-map"
      whenReady={() => {
        // Access the map instance via the internal leaflet_id on the container element
        try {
          const el = document.getElementById('binlink-map') as any;
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
      {selectedBin && <MapFlyTo bin={selectedBin} />}
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
      {bins.map((bin) => (
        <Marker
          key={bin.id}
          position={[bin.location.lat, bin.location.lng]}
          icon={(() => {
            const pctFromMetrics = typeof bin.fill_pct === 'number' ? Math.round(Math.max(0, Math.min(100, bin.fill_pct))) : null;
            const tds = Number(bin.data?.tds ?? NaN);
            const pctFromDemo = isFinite(tds) ? Math.round(Math.max(0, Math.min(100, ((tds - 200) / (800 - 200)) * 100))) : null;
            const pct = pctFromMetrics ?? (pctFromDemo ?? 0);
            const effectiveStatus: BinData['status'] = pct >= 80 ? 'critical' : bin.status;
            return createCustomIcon(effectiveStatus, highlightedBinIds.includes(bin.id));
          })()}
          ref={(ref) => { if (ref) markerRefs[bin.id] = ref; }}
          eventHandlers={{ click: () => onBinSelect(bin) }}
        >
          <Popup className="bin-popup">
            <div className="p-3 min-w-[220px] space-y-2 font-sans rounded-lg">
              <div className="flex items-start justify-between gap-4">
                <h3 className="font-semibold text-foreground leading-snug text-sm flex items-center gap-2">
                  <span>{bin.name}</span>
                  {bin.bin_type && (
                    <span className="px-1.5 py-0.5 text-[10px] rounded bg-muted/60 text-muted-foreground border border-border/40">
                      {String(bin.bin_type).toUpperCase()}
                    </span>
                  )}
                </h3>
                <span className={`shrink-0 px-2 py-0.5 rounded-md text-[10px] font-semibold tracking-wide backdrop-blur-sm ${
                  bin.status === 'active' ? 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-400/30' :
                  (bin.status === 'warning' || bin.status === 'critical') ? 'bg-red-500/15 text-red-400 ring-1 ring-red-400/30' :
                  'bg-muted/60 text-muted-foreground ring-1 ring-border/40'
                }`}>{bin.status === 'active' ? 'CLOSED' : 'OPEN'}</span>
              </div>
              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between"><span className="text-muted-foreground">Bin Location</span><span className="font-medium text-foreground truncate max-w-[140px] text-right">{bin.label || '—'}</span></div>
                {bin.bin_type && (
                  <div className="flex justify-between"><span className="text-muted-foreground">Bin Type</span><span className="font-medium text-foreground text-right">{String(bin.bin_type).toUpperCase()}</span></div>
                )}
                <div className="flex justify-between"><span className="text-muted-foreground">Bin Level</span><span className="font-medium text-foreground text-right">{(() => {
                  const pct = typeof bin.fill_pct === 'number'
                    ? Math.round(Math.max(0, Math.min(100, bin.fill_pct)))
                    : (() => { const t = Number(bin.data?.tds ?? NaN); return isFinite(t) ? Math.round(Math.max(0, Math.min(100, ((t - 200) / (800 - 200)) * 100))) : 0; })();
                  return isFinite(pct) ? pct : 0;
                })()}%</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Status</span><span className="font-medium text-foreground text-right">{bin.status === 'offline' ? 'Offline' : 'Online'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Bin Lid</span><span className="font-medium text-foreground text-right">{bin.status === 'offline' ? '—' : (typeof bin.is_open === 'boolean' ? (bin.is_open ? 'Open' : 'Closed') : (bin.status === 'active' ? 'Closed' : 'Open'))}</span></div>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">Updated {(bin.updated_at ?? bin.data.lastUpdated).toLocaleTimeString()}</p>
              {(() => {
                const pct = typeof bin.fill_pct === 'number'
                  ? Math.round(Math.max(0, Math.min(100, bin.fill_pct)))
                  : (() => { const t = Number(bin.data?.tds ?? NaN); return isFinite(t) ? Math.round(Math.max(0, Math.min(100, ((t - 200) / (800 - 200)) * 100))) : 0; })();
                if (pct >= 100) {
                  return <p className="text-[10px] text-red-500 font-medium">Bin is Full!</p>;
                } else if (pct > 80) {
                  return <p className="text-[10px] text-red-500 font-medium">Bin Almost Full</p>;
                }
                return <p className="text-[10px] text-muted-foreground">{bin.status === 'active' ? 'All good. Monitoring fill level.' : 'Attention: Bin may be open.'}</p>;
              })()}
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${bin.location.lat},${bin.location.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="group w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 hover:bg-primary/15 text-primary dark:text-primary text-[11px] font-medium tracking-wide px-3 py-1.5 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1 focus-visible:ring-offset-background transition-colors disabled:opacity-60 disabled:cursor-not-allowed no-underline"
              >
                <ExternalLink className="h-3.5 w-3.5 opacity-90 group-hover:opacity-100 transition-opacity" />
                <span className="">Open in Google Maps</span>
              </a>
              {role === 'admin' && (
                <button
                  type="button"
                  className="mt-1 w-full text-[11px] px-3 py-1.5 rounded-lg bg-secondary/60 hover:bg-secondary/70 text-foreground border border-border/60"
                  onClick={() => {
                    try {
                      // Dispatch a custom event to open Sidebar's send report dialog with this bin
                      const ev = new CustomEvent('bl:openReport', { detail: { id: bin.id, name: bin.name, fill: typeof bin.fill_pct==='number'?Math.round(bin.fill_pct):undefined, is_open: typeof bin.is_open==='boolean'?bin.is_open:undefined } });
                      window.dispatchEvent(ev);
                    } catch {}
                  }}
                >
                  Send report
                </button>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}

// Component to animate map view when selectedWell changes
function MapFlyTo({ bin }: { bin: BinData }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([bin.location.lat, bin.location.lng], 15, { duration: 1.2, easeLinearity: 0.25 });
  }, [bin, map]);
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