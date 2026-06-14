import { useEffect, useRef } from "react";
import { useListInspections, useGetHotspots } from "@workspace/api-client-react";
import { MapContainer, TileLayer, Marker, Popup, Circle, useMapEvents, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { Card } from "@/components/ui/card";
import { AlertTriangle, Map as MapIcon, Flame } from "lucide-react";
import { useOfflineSync } from "@/lib/offline-sync";
import { Link, useLocation, useSearch } from "wouter";

// Fix standard Leaflet icon issue in Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const createCustomIcon = (color: string) => {
  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="background-color: ${color}; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.5);"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
};

const iconCritical = createCustomIcon('#ef4444');
const iconMedium = createCustomIcon('#f59e0b');
const iconLow = createCustomIcon('#22c55e');

function MapEvents({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

/** Fly to a given lat/lng when they change */
function FlyToHotspot({ lat, lng }: { lat: number | null; lng: number | null }) {
  const map = useMap();
  const didFly = useRef(false);
  useEffect(() => {
    if (lat !== null && lng !== null && !didFly.current) {
      didFly.current = true;
      map.flyTo([lat, lng], 13, { duration: 1.2 });
    }
  }, [lat, lng, map]);
  return null;
}

export default function MapView() {
  const { data: inspections } = useListInspections();
  const { data: hotspots } = useGetHotspots();
  const { isOnline } = useOfflineSync();
  const [, setLocation] = useLocation();
  const search = useSearch();

  const params = new URLSearchParams(search);
  const focusLat = params.has("lat") ? Number(params.get("lat")) : null;
  const focusLng = params.has("lng") ? Number(params.get("lng")) : null;

  const handleMapClick = (lat: number, lng: number) => {
    setLocation(`/log?lat=${lat}&lng=${lng}`);
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col space-y-4 animate-in fade-in duration-500">
      <div className="flex items-center gap-2">
        <MapIcon className="h-6 w-6 text-primary" />
        <h1 className="text-3xl font-bold tracking-tight uppercase">Map View</h1>
        {hotspots && hotspots.length > 0 && (
          <span className="ml-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-destructive/10 border border-destructive/30 text-destructive text-xs font-bold uppercase tracking-wider">
            <Flame className="h-3 w-3" />
            {hotspots.length} hotspot{hotspots.length > 1 ? "s" : ""}
          </span>
        )}
      </div>

      {!isOnline && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          <span className="text-sm font-medium">Map tiles may be unavailable offline — coordinates captured manually.</span>
        </div>
      )}

      <Card className="flex-1 overflow-hidden border-card-border relative shadow-lg">
        <MapContainer 
          center={[37.7749, -122.4194]} 
          zoom={12} 
          style={{ height: "100%", width: "100%", background: "#1a1f26" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            className="map-tiles"
          />
          <MapEvents onMapClick={handleMapClick} />
          {focusLat !== null && focusLng !== null && (
            <FlyToHotspot lat={focusLat} lng={focusLng} />
          )}

          {/* Hotspot radius circles */}
          {hotspots?.map((h) => (
            <Circle
              key={`hotspot-${h.id}`}
              center={[h.centerLat, h.centerLng]}
              radius={h.radiusKm * 1000}
              pathOptions={{
                color: "#ef4444",
                fillColor: "#ef4444",
                fillOpacity: 0.08,
                weight: 1.5,
                dashArray: "6 4",
              }}
            >
              <Popup>
                <div className="p-1 space-y-2">
                  <div className="flex items-center gap-1 font-bold text-destructive text-sm border-b border-border pb-1">
                    <span>⚠ Hotspot — {h.count} Critical Issues</span>
                  </div>
                  <ul className="space-y-1 mt-1">
                    {h.titles.map((title, i) => (
                      <li key={i} className="text-xs text-foreground">• {title}</li>
                    ))}
                  </ul>
                  <div className="text-xs text-muted-foreground font-mono mt-1">
                    {h.radiusKm} km radius · {h.centerLat.toFixed(4)}, {h.centerLng.toFixed(4)}
                  </div>
                </div>
              </Popup>
            </Circle>
          ))}

          {/* Inspection markers */}
          {inspections?.map((inspection) => {
            const icon = inspection.severity === 'Critical' ? iconCritical : 
                         inspection.severity === 'Medium' ? iconMedium : iconLow;
            
            return (
              <Marker 
                key={inspection.id} 
                position={[inspection.latitude, inspection.longitude]}
                icon={icon}
              >
                <Popup className="custom-popup">
                  <div className="p-1 space-y-2">
                    <h3 className="font-bold text-base border-b border-border pb-1">{inspection.title}</h3>
                    <div className="grid grid-cols-2 gap-2 text-sm mt-2">
                      <span className="text-muted-foreground font-medium uppercase text-xs">Type:</span>
                      <span className="font-mono">{inspection.issueType}</span>
                      
                      <span className="text-muted-foreground font-medium uppercase text-xs">Severity:</span>
                      <span className={`font-bold uppercase tracking-wider text-xs ${
                        inspection.severity === 'Critical' ? 'text-destructive' : 
                        inspection.severity === 'Medium' ? 'text-primary' : 'text-green-500'
                      }`}>{inspection.severity}</span>
                    </div>
                    {inspection.imageData && (
                      <img
                        src={inspection.imageData}
                        alt="Site photo"
                        className="mt-2 w-full rounded object-cover max-h-32 border border-border"
                      />
                    )}
                    <p className="text-sm mt-2 line-clamp-3 text-muted-foreground">{inspection.description}</p>
                    <div className="mt-3 pt-2 border-t border-border">
                      <Link href={`/inspections/${inspection.id}`} className="text-primary hover:underline text-sm font-bold uppercase tracking-wider">
                        View Details →
                      </Link>
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
        
        <style dangerouslySetInnerHTML={{__html: `
          .map-tiles {
            filter: invert(100%) hue-rotate(180deg) brightness(95%) contrast(90%);
          }
          .leaflet-popup-content-wrapper, .leaflet-popup-tip {
            background-color: hsl(var(--card));
            color: hsl(var(--card-foreground));
            border: 1px solid hsl(var(--border));
            border-radius: var(--radius);
          }
        `}} />
      </Card>
      <p className="text-xs text-muted-foreground uppercase tracking-wider font-mono text-center">
        Click anywhere on the map to log a new inspection at those coordinates.
      </p>
    </div>
  );
}
