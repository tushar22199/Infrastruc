---
name: Developer Testing Panel gating
description: How the temporary dev panel is hidden, and the deployment constraint that keeps it out of production.
---

# Developer Testing Panel gate

The temporary Developer Testing Panel (can generate fake inspection records) is
hidden by default and unlocks via EITHER `VITE_DEV_MODE === "true"` OR a "secret
knock" — 5 consecutive clicks on the sidebar logo (streak resets after a >1.5s
gap). State lives in `dev-mode.ts` and is read reactively with
`useSyncExternalStore`.

- **Keep `VITE_DEV_MODE` UNSET in deployment workflows.** Setting it to `"true"`
  exposes the panel — and thus fake-record creation — immediately in production.
  **Why:** it is a build-time Vite env; a stray value ships straight to users.
- **This is a client-side visibility gate, NOT authorization.** The panel only
  calls the same authenticated inspection API any logged-in user can already hit,
  so it adds no new privilege path — but do not treat the knock/flag as a security
  boundary. If real access control is ever needed, enforce it server-side.
- The panel is still statically imported into the dashboard bundle (shipped but
  not mounted while locked). If production *concealment* ever matters, switch to a
  dynamic import gated on unlock.
