import { useEffect, useRef, useState, useCallback } from "react";
import { useListInspections, useGetHotspots } from "@workspace/api-client-react";
import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline, Polygon, useMapEvents, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { Card } from "@/components/ui/card";
import { AlertTriangle, Map as MapIcon, Flame, Search, Loader2, X } from "lucide-react";
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

const searchPinIcon = L.divIcon({
  className: 'custom-div-icon',
  html: `<div style="background-color: #6366f1; width: 18px; height: 18px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 8px rgba(99,102,241,0.8);"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const iconCritical = createCustomIcon('#ef4444');
const iconMedium = createCustomIcon('#f59e0b');
const iconLow = createCustomIcon('#22c55e');

const SEVERITY_COLOR: Record<string, string> = { Critical: '#ef4444', Medium: '#f59e0b', Low: '#22c55e' };
// GeoJSON: [lng, lat] → Leaflet: [lat, lng]
const geoToLl = (c: unknown): [number, number] => { const p = c as number[]; return [p[1], p[0]]; };

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type: string;
  class: string;
}

function MapEvents({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

/** Fly to a given lat/lng when they change */
function FlyToPosition({ lat, lng, zoom = 13 }: { lat: number | null; lng: number | null; zoom?: number }) {
  const map = useMap();
  const prevKey = useRef<string | null>(null);
  useEffect(() => {
    if (lat !== null && lng !== null) {
      const key = `${lat},${lng}`;
      if (key !== prevKey.current) {
        prevKey.current = key;
        map.flyTo([lat, lng], zoom, { duration: 1.4 });
      }
    }
  }, [lat, lng, zoom, map]);
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

  // Location search state
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchPin, setSearchPin] = useState<{ lat: number; lng: number; label: string } | null>(null);
  const [flyTo, setFlyTo] = useState<{ lat: number; lng: number; zoom: number } | null>(null);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const handleMapClick = (lat: number, lng: number) => {
    setLocation(`/log?lat=${lat}&lng=${lng}`);
  };

  const handleSearch = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    const q = query.trim();
    if (!q) return;

    setIsSearching(true);
    setSearchError(null);
    setResults([]);

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&addressdetails=1`,
        { headers: { "Accept-Language": "en" } }
      );
      if (!res.ok) throw new Error("Search failed");
      const data: NominatimResult[] = await res.json();
      if (data.length === 0) {
        setSearchError("No locations found. Try a different search.");
      } else {
        setResults(data);
        setShowResults(true);
      }
    } catch {
      setSearchError("Search unavailable. Check your connection.");
    } finally {
      setIsSearching(false);
    }
  }, [query]);

  const selectResult = (result: NominatimResult) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    const label = result.display_name.split(",").slice(0, 2).join(", ");
    setSearchPin({ lat, lng, label });
    setFlyTo({ lat, lng, zoom: 14 });
    setShowResults(false);
    setResults([]);
  };

  const clearSearch = () => {
    setQuery("");
    setResults([]);
    setSearchError(null);
    setShowResults(false);
    setSearchPin(null);
    setFlyTo(null);
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

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

          {/* Fly to hotspot from dashboard */}
          {focusLat !== null && focusLng !== null && flyTo === null && (
            <FlyToPosition lat={focusLat} lng={focusLng} zoom={13} />
          )}
          {/* Fly to search result */}
          {flyTo && <FlyToPosition lat={flyTo.lat} lng={flyTo.lng} zoom={flyTo.zoom} />}

          {/* Search result pin */}
          {searchPin && (
            <Marker position={[searchPin.lat, searchPin.lng]} icon={searchPinIcon}>
              <Popup>
                <div className="p-1 space-y-1">
                  <div className="font-bold text-sm text-indigo-400 uppercase tracking-wider">Search Result</div>
                  <div className="text-sm text-foreground">{searchPin.label}</div>
                  <div className="text-xs font-mono text-muted-foreground">
                    {searchPin.lat.toFixed(5)}, {searchPin.lng.toFixed(5)}
                  </div>
                </div>
              </Popup>
            </Marker>
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

          {/* Inspection overlays — Point → Marker, LineString → Polyline, Polygon → shaded Area */}
          {inspections?.map((inspection) => {
            const color = SEVERITY_COLOR[inspection.severity] ?? '#22c55e';
            const icon = inspection.severity === 'Critical' ? iconCritical :
                         inspection.severity === 'Medium' ? iconMedium : iconLow;
            const geom = inspection.geometry;

            const popupContent = (
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
                    {geom.type !== "Point" && (
                      <>
                        <span className="text-muted-foreground font-medium uppercase text-xs">Shape:</span>
                        <span className="font-mono text-xs">{geom.type === "LineString" ? "Line" : "Area"}</span>
                      </>
                    )}
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
            );

            if (geom.type === "LineString") {
              return (
                <Polyline key={inspection.id} positions={geom.coordinates.map(geoToLl)} pathOptions={{ color, weight: 4, opacity: 0.85 }}>
                  {popupContent}
                </Polyline>
              );
            }

            if (geom.type === "Polygon") {
              return (
                <Polygon key={inspection.id} positions={(geom.coordinates[0] as unknown[]).map(geoToLl)} pathOptions={{ color, fillColor: color, fillOpacity: 0.2, weight: 2, opacity: 0.85 }}>
                  {popupContent}
                </Polygon>
              );
            }

            return (
              <Marker key={inspection.id} position={[inspection.latitude, inspection.longitude]} icon={icon}>
                {popupContent}
              </Marker>
            );
          })}
        </MapContainer>

        {/* Location search overlay */}
        <div
          ref={searchRef}
          className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] w-full max-w-sm px-3"
          style={{ pointerEvents: "auto" }}
        >
          <form
            onSubmit={handleSearch}
            className="flex items-center gap-1.5 bg-card/95 backdrop-blur-sm border border-border rounded-lg shadow-xl px-3 py-2"
          >
            {isSearching ? (
              <Loader2 className="h-4 w-4 text-muted-foreground animate-spin flex-shrink-0" />
            ) : (
              <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            )}
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSearchError(null);
              }}
              onFocus={() => results.length > 0 && setShowResults(true)}
              placeholder="Search location…"
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 outline-none min-w-0 font-medium"
            />
            {(query || searchPin) && (
              <button
                type="button"
                onClick={clearSearch}
                className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              type="submit"
              className="flex-shrink-0 text-xs font-bold uppercase tracking-wider text-primary hover:text-primary/80 transition-colors pl-1.5 border-l border-border ml-0.5"
            >
              Go
            </button>
          </form>

          {/* Error */}
          {searchError && (
            <div className="mt-1.5 bg-card/95 backdrop-blur-sm border border-destructive/30 rounded-lg px-3 py-2 text-xs text-destructive font-medium shadow-lg">
              {searchError}
            </div>
          )}

          {/* Results dropdown */}
          {showResults && results.length > 0 && (
            <ul className="mt-1.5 bg-card/98 backdrop-blur-sm border border-border rounded-lg shadow-xl overflow-hidden divide-y divide-border">
              {results.map((r) => {
                const parts = r.display_name.split(",");
                const primary = parts.slice(0, 2).join(",").trim();
                const secondary = parts.slice(2, 4).join(",").trim();
                return (
                  <li key={r.place_id}>
                    <button
                      type="button"
                      className="w-full text-left px-3 py-2.5 hover:bg-secondary/60 transition-colors group"
                      onClick={() => selectResult(r)}
                    >
                      <div className="flex items-start gap-2">
                        <div className="mt-0.5 w-5 h-5 rounded-full bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center flex-shrink-0">
                          <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-foreground truncate">{primary}</div>
                          {secondary && (
                            <div className="text-[11px] text-muted-foreground truncate mt-0.5">{secondary}</div>
                          )}
                          <div className="text-[10px] font-mono text-muted-foreground/60 mt-0.5">
                            {parseFloat(r.lat).toFixed(4)}, {parseFloat(r.lon).toFixed(4)}
                          </div>
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

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
        Search a location to navigate · Click anywhere on the map to log a new inspection.
      </p>
    </div>
  );
}
