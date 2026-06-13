# Intelligent Field Inspection & Infrastructure Auditor

A full-stack offline-first web app for civil engineers to log, track, and analyze infrastructure failures in the field — complete with geospatial map view, automated PDF reporting, and real-time health scoring.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/field-inspector run dev` — run the frontend (port assigned by workflow)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React (Vite), Tailwind CSS, Lucide React, Framer Motion
- Mapping: Leaflet + react-leaflet
- PDF: jspdf + jspdf-autotable
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — API contract source of truth
- `lib/db/src/schema/inspections.ts` — inspections table schema
- `artifacts/api-server/src/routes/inspections.ts` — CRUD routes
- `artifacts/api-server/src/routes/dashboard.ts` — dashboard summary & analytics
- `artifacts/field-inspector/src/` — React frontend

## Architecture decisions

- Offline-first: inspections are written to `localStorage` queue first, then synced to API. Background sync triggers automatically when reconnecting.
- OpenAPI-first contract: spec drives Zod validation on the server and typed React Query hooks on the client — no manually written types.
- Regional Health Score computed server-side from active issues: Critical = -15, Medium = -5, Low = -2 deducted from 100.
- Leaflet map uses custom color-coded divIcon markers per severity; no heavy chart library needed for geo features.
- PDF export runs entirely client-side via jspdf — no server round-trip required.

## Product

- **Dashboard**: Total logs, active issues, Regional Health Score (0–100), breakdown by severity and type, Export Audit Report PDF button.
- **Map View**: Color-coded markers (Red=Critical, Orange=Medium, Green=Low) with info popups. Click-to-capture coordinates for new inspections.
- **Log Inspection**: Offline-first form. Saves to localStorage queue first, then syncs to API. Background sync with toast notification on reconnect.
- **Inspections List**: Searchable, filterable table of all records with status badges.
- **Inspection Detail**: Full record view with embedded map, status update capability.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- After any `lib/db/src/schema` change, run `pnpm run typecheck:libs` before the artifact typecheck or imports will appear broken.
- react-leaflet requires `import "leaflet/dist/leaflet.css"` and the default icon URL workaround in each component that renders markers.
- jspdf-autotable is a side-effect import on the jsPDF prototype — always import it alongside jspdf.
- `pnpm run build` needs workflow-provided `PORT` and `BASE_PATH`; use `typecheck` to verify without running the dev server.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
