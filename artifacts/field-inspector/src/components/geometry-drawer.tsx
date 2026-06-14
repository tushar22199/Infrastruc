import { MapContainer, TileLayer, Marker, Polyline, Polygon, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { Undo2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

const pointIcon = L.divIcon({
  className: "custom-div-icon",
  html: `<div style="background-color:#f59e0b;width:14px;height:14px;border-radius:50%;border:2.5px solid white;box-shadow:0 1px 5px rgba(0,0,0,0.5);"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

const vertexIcon = L.divIcon({
  className: "custom-div-icon",
  html: `<div style="background-color:#6366f1;width:10px;height:10px;border-radius:50%;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.4);"></div>`,
  iconSize: [10, 10],
  iconAnchor: [5, 5],
});

export type GeomType = "Point" | "LineString" | "Polygon";
export type Vertex = [number, number];

function DrawerEvents({ onAddVertex }: { onAddVertex: (lng: number, lat: number) => void }) {
  useMapEvents({
    click(e) {
      onAddVertex(e.latlng.lng, e.latlng.lat);
    },
  });
  return null;
}

interface GeometryDrawerProps {
  geometryType: GeomType;
  vertices: Vertex[];
  onAddVertex: (lng: number, lat: number) => void;
  onUndo: () => void;
  onClear: () => void;
  initialCenter?: [number, number];
}

export function GeometryDrawer({
  geometryType,
  vertices,
  onAddVertex,
  onUndo,
  onClear,
  initialCenter = [39.5, -98.35],
}: GeometryDrawerProps) {
  const toLl = (v: Vertex): [number, number] => [v[1], v[0]];
  const llPositions = vertices.map(toLl);
  const mapCenter: [number, number] = llPositions.length > 0 ? llPositions[0] : initialCenter;
  const mapZoom = llPositions.length > 0 ? 14 : 4;

  const minPoints = geometryType === "Point" ? 1 : geometryType === "LineString" ? 2 : 3;
  const isValid = geometryType === "Point" ? vertices.length === 1 : vertices.length >= minPoints;

  const statusText =
    vertices.length === 0
      ? geometryType === "Point"
        ? "Click the map to drop a pin"
        : geometryType === "LineString"
          ? "Click to add vertices — need ≥ 2 points"
          : "Click to add vertices — need ≥ 3 points"
      : geometryType === "Point"
        ? `Pin at ${vertices[0][1].toFixed(5)}, ${vertices[0][0].toFixed(5)}`
        : `${vertices.length} point${vertices.length !== 1 ? "s" : ""} · ${isValid ? "✓ ready" : `need ${minPoints - vertices.length} more`}`;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between min-h-6">
        <p className="text-xs font-mono text-muted-foreground">{statusText}</p>
        {vertices.length > 0 && (
          <div className="flex items-center gap-1">
            {geometryType !== "Point" && (
              <Button type="button" variant="ghost" size="sm" onClick={onUndo} className="h-7 px-2 text-xs gap-1">
                <Undo2 className="h-3 w-3" />
                Undo
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClear}
              className="h-7 px-2 text-xs gap-1 text-destructive hover:text-destructive"
            >
              <Trash2 className="h-3 w-3" />
              Clear
            </Button>
          </div>
        )}
      </div>

      <div className="relative rounded-md overflow-hidden border border-border" style={{ height: 240 }}>
        <MapContainer center={mapCenter} zoom={mapZoom} style={{ height: "100%", width: "100%" }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            className="drawer-tiles"
          />
          <DrawerEvents onAddVertex={onAddVertex} />

          {geometryType === "Point" && llPositions.length > 0 && (
            <Marker position={llPositions[0]} icon={pointIcon} />
          )}

          {geometryType === "LineString" && (
            <>
              {llPositions.length >= 2 && (
                <Polyline positions={llPositions} pathOptions={{ color: "#f59e0b", weight: 3, opacity: 0.9 }} />
              )}
              {llPositions.map((pos, i) => (
                <Marker key={i} position={pos} icon={vertexIcon} />
              ))}
            </>
          )}

          {geometryType === "Polygon" && (
            <>
              {llPositions.length >= 3 && (
                <Polygon
                  positions={llPositions}
                  pathOptions={{ color: "#f59e0b", fillColor: "#f59e0b", fillOpacity: 0.2, weight: 2, opacity: 0.9 }}
                />
              )}
              {llPositions.map((pos, i) => (
                <Marker key={i} position={pos} icon={vertexIcon} />
              ))}
            </>
          )}
        </MapContainer>
        <style dangerouslySetInnerHTML={{ __html: `.drawer-tiles{filter:invert(100%) hue-rotate(180deg) brightness(95%) contrast(90%)}` }} />
      </div>
    </div>
  );
}
