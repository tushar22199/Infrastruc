---
name: GeoJSON geometry upgrade
description: Architectural decisions from adding spatial GeoJSON geometry (Point/LineString/Polygon) to inspections alongside legacy lat/lng columns.
---

## Decision: keep lat/lng columns NOT NULL, derive from geometry

The `latitude`/`longitude` columns in `inspectionsTable` are kept NOT NULL. Geometry's representative point (first coordinate of any geometry type) is extracted server-side to populate them. This gives backward compatibility: old code that reads lat/lng still works, new code uses geometry.

**Why:** Dropping lat/lng would require a migration that's risky with existing data. Keeping them as a derived/denormalized field means the server remains the single source of truth.

**How to apply:** `representativePoint(geom)` in `inspections.ts` extracts `{lat, lng}` from any GeoJSON type. Always call this when creating or updating records with geometry.

## Decision: synthesize Point geometry for old records at read time

Old DB records have `geometry = null`. The `withGeometry()` helper in `inspections.ts` synthesizes `{type:"Point", coordinates:[lng, lat]}` on every read for rows where `geometry IS NULL`. This is applied in all GET routes.

**Why:** Avoids a one-time data migration — synthesis is free at read time and old records naturally become valid GeoJSON Points.

## GeoJSON vs Leaflet coordinate order

GeoJSON stores coordinates as `[longitude, latitude]`. Leaflet expects `[latitude, longitude]`.

The `geoToLl` helper: `(c: unknown): [number, number] => { const p = c as number[]; return [p[1], p[0]]; }` converts between them. Used in map-view.tsx and inspection-detail.tsx for Polyline/Polygon rendering.

**Critical:** Never pass GeoJSON coordinates directly to Leaflet without this conversion — the map will silently flip lat/lng.

## Schema

- `geometry` column: nullable JSONB in `inspectionsTable`
- `InspectionGeometry` type (from codegen): `{ type: 'Point' | 'LineString' | 'Polygon'; coordinates: unknown[] }`
- `geometry` is required in `Inspection` output (synthesized server-side, so always present)
- `geometry` is required in `InspectionInput` (form validates before submit)

## Offline queue

The offline sync queue (IndexedDB, Dexie) stores the full GeoJSON payload. The `InspectionInput` payload sent to `addToQueue()` must include `geometry` — not legacy `latitude`/`longitude`. The backend accepts and stores both.
