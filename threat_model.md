# Threat Model

## Project Overview

This project is an offline-first field inspection system for civil engineers. It has a React frontend, an Express API, and a PostgreSQL database accessed through Drizzle. Engineers log infrastructure failures, store geospatial coordinates and optional photo evidence, review dashboards, assign work, and collaborate through comments and notifications. In production, the mockup sandbox artifact is out of scope unless separate evidence shows it is reachable.

## Assets

- **Inspection records and geospatial locations** — titles, descriptions, severity, status, precise coordinates, geometry, scheduling metadata, and related analytics. Exposure could reveal sensitive infrastructure weaknesses and exact field locations.
- **Photo evidence and field notes** — base64-encoded site images and comments attached to inspections. These can contain operationally sensitive details about facilities, failures, and remediation progress.
- **User identity and team activity data** — engineer identities, assignments, activity logs, notifications, and attribution fields. Compromise can expose staffing patterns and enable impersonation or unauthorized workflow changes.
- **Sessions and OIDC tokens** — session IDs in cookies or bearer form plus stored OIDC access/refresh tokens in the sessions table. Compromise enables account takeover.
- **Application secrets and database access** — environment-provided database credentials and OIDC configuration values. Compromise gives broad backend control.

## Trust Boundaries

- **Browser/mobile client to API** — all client input is untrusted. The API must authenticate and authorize requests for inspection data and workflow actions.
- **API to PostgreSQL** — the API has direct read/write access to inspections, comments, notifications, sessions, and users. Broken access control or unsafe query construction at the API layer can expose or tamper with all records.
- **API to OIDC provider** — the server exchanges authorization codes and refresh tokens with Replit OIDC. Session issuance and token refresh logic must resist spoofing and token leakage.
- **Unauthenticated to authenticated user boundary** — the frontend presents the system as login-gated, so backend enforcement must match that expectation.
- **Production to dev-only boundary** — `artifacts/mockup-sandbox/` is development-only and should be ignored during production security review unless proven reachable.

## Scan Anchors

- Production API entry points: `artifacts/api-server/src/index.ts`, `artifacts/api-server/src/app.ts`, and route files under `artifacts/api-server/src/routes/`.
- Highest-risk server surfaces: `inspections.ts`, `dashboard.ts`, `comments.ts`, `assign.ts`, `activity.ts`, `notifications.ts`, and auth/session handling in `middlewares/authMiddleware.ts` plus `lib/auth.ts`.
- Membership boundary anchor: `routes/auth.ts` auto-provisions successful OIDC logins into `usersTable`; future scans must verify that authentication is not being mistaken for engineer authorization.
- Public vs authenticated surfaces: `healthz`, login/callback, and mobile auth endpoints are intentionally public; inspection, dashboard, assignment, comment, and activity endpoints should be treated as authenticated business surfaces unless explicitly documented otherwise.
- Dev-only area: `artifacts/mockup-sandbox/`.

## Threat Categories

### Spoofing

Users authenticate through Replit OIDC, with the API converting browser cookies or bearer tokens into `req.user`. The system must only treat requests as authenticated when a valid live session is present, must refresh or clear expired sessions safely, and must never allow anonymous callers to act as named engineers through client-controlled fields or fallback display names. Successful OIDC login alone is not enough authorization for this application: the backend must distinguish trusted engineers from arbitrary external Replit identities before granting access to operational data.

### Tampering

Inspection creation, batch sync, status changes, assignment, deletion, and comments all modify operational records. The client is untrusted even though it is offline-first; all workflow mutations must be authorized server-side and must not rely on the frontend login gate to protect write operations.

### Information Disclosure

Inspection records, exact coordinates, hotspot analytics, overdue schedules, comments, activity feeds, and photo evidence are sensitive operational data. The API must restrict these responses to authorized users and must not expose them through unauthenticated endpoints simply because the frontend hides the UI behind a login screen.

### Denial of Service

Public-facing endpoints that read full inspection datasets or accept large JSON payloads can be abused to consume database, CPU, and bandwidth resources. The production system must keep expensive data access and large write paths behind authentication and apply request-size and abuse controls appropriate for public internet exposure.

### Elevation of Privilege

There is no separate admin role in the current codebase, so the main privilege boundary is anonymous user versus authenticated engineer. The backend must enforce that only authenticated engineers can read or mutate inspection workflows, assignments, comments, and analytics; otherwise an internet user can escalate from no access to full operational control. That guarantee requires a real engineer-membership check or approval flow, not just possession of any valid OIDC identity.
