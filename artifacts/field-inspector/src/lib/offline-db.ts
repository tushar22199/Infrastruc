import Dexie, { type Table } from "dexie";
import type { InspectionInput } from "@workspace/api-client-react";

export interface PendingInspection {
  id?: number;
  queuedAt: number;
  payload: InspectionInput;
}

class OfflineInspectionsDB extends Dexie {
  pendingInspections!: Table<PendingInspection, number>;

  constructor() {
    super("offline_inspections_db");
    this.version(1).stores({
      pendingInspections: "++id, queuedAt",
    });
  }
}

export const offlineDb = new OfflineInspectionsDB();

try {
  localStorage.removeItem("pending_inspections");
} catch {
  // ignore — localStorage may be unavailable
}
