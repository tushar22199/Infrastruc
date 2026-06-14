---
name: Offline sync architecture (field-inspector)
description: How the offline inspection queue works and the non-obvious traps that cause duplicate or photo-less records.
---

# Offline inspection sync

The offline queue is the **single source of truth**. New inspections are written
to IndexedDB (Dexie store `offline_inspections_db`) and a background sync engine
drains it via the batch POST endpoint, deleting rows by id only after a 201.

## Rules / lessons

- **Never do a direct POST *and* enqueue the same inspection.** An earlier design
  queued every submission AND fired a single-create POST; online submissions left
  the row in the queue, which then re-synced via batch and created a duplicate
  record (and the duplicate lost its photo). One path only: queue → sync engine.
  **Why:** double-write paths drift out of sync and duplicate.

- **The batch insert route must map ALL fields** the single-create route does —
  `imageData`, `reinspectionInterval`, `nextReinspectionDate`. It is easy to add a
  field to single-create and forget the batch route; the symptom is queue-synced
  records missing photos / re-inspection schedule.

- **Acquire the module-level sync lock synchronously, before any `await`.**
  `useOfflineSync` is instantiated by multiple components (always-mounted Layout +
  the current page), and StrictMode double-invokes effects. If the lock is set
  after the first `await` (the IndexedDB read), two callers both pass the guard,
  read the same rows, and double-POST. **How to apply:** check+set the lock in one
  synchronous block at the top of `syncQueue`, release in `finally`.

- **Drain in a loop.** Rows enqueued while a sync is in flight must be processed
  after the current batch, or they sit until the next online event/page reload.
  Loop while `rerunRequested || pendingCount > 0`; concurrent callers set
  `rerunRequested` instead of starting a second run.

- **Delete by captured ids (`bulkDelete(ids)`), not `clear()`.** Clearing the
  whole store would drop rows added between the read snapshot and the delete.

## Network status override (for testing / simulated offline)

Connectivity is read through a single `getEffectiveOnline()` (in `network-status.ts`)
— a module-level forced override (`"online"|"offline"|null`) wins over
`navigator.onLine`. React reads it via `useEffectiveOnline()` (a
`useSyncExternalStore`). The sync engine and the sidebar badge both consult it, so
a dev toggle can simulate offline app-wide.

- **Do not read `navigator.onLine` directly** anywhere connectivity matters — go
  through `getEffectiveOnline()`, or a forced-offline toggle won't actually stop
  syncing. **Why:** a missed call site silently ignores the override.
- **Re-check `getEffectiveOnline()` at the top of every drain iteration**, not just
  at `syncQueue` entry. Otherwise rows queued right after a mid-flight
  force-offline get posted by the still-running loop, breaking the offline guarantee.
- Swapping a hook's signature (e.g. `useState(navigator.onLine)` →
  `useSyncExternalStore`) in an always-mounted component (Layout) throws a
  "change in the order of Hooks" error **only under HMR**; it clears on a full
  reload / workflow restart and is not a real bug.
