import { useEffect, useState } from "react";
import { useListInspections } from "@workspace/api-client-react";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { Card } from "@/components/ui/card";
import { AlertTriangle, Map as MapIcon } from "lucide-react";
import { useOfflineSync } from "@/lib/offline-sync";
import { Link, useLocation } from "wouter";

// Fix standard Leaflet icon issue in Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom markers using standard leaflet colors but tinted via CSS/hue or custom SVGs if possible
// We will use divIcon for custom colored markers
const createCustomIcon = (color: string) => {
  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="background-color: ${color}; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.5);"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
};

const iconCritical = createCustomIcon('#ef4444'); // destructive
const iconMedium = createCustomIcon('#f59e0b'); // primary/amber
const iconLow = createCustomIcon('#22c55e'); // green

function MapEvents({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function MapView() {
  const { data: inspections } = useListInspections();
  const { isOnline } = useOfflineSync();
  const [, setLocation] = useLocation();

  const handleMapClick = (lat: number, lng: number) => {
    // Navigate to log page with coordinates
    setLocation(`/log?lat=${lat}&lng=${lng}`);
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col space-y-4 animate-in fade-in duration-500">
      <div className="flex items-center gap-2">
        <MapIcon className="h-6 w-6 text-primary" />
        <h1 className="text-3xl font-bold tracking-tight uppercase">Map View</h1>
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
          style={{ height: "100%", width: "100%", background: "#1a1f26" }} // dark background for map container
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            className="map-tiles"
          />
          <MapEvents onMapClick={handleMapClick} />
          
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
        
        {/* CSS override for dark mode map (simple inversion filter) */}
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
