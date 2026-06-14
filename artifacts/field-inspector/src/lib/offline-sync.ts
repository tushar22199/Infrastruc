import { useState, useEffect, useCallback, useRef } from "react";
import {
  useBatchCreateInspections,
  getListInspectionsQueryKey,
  type InspectionInput,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLiveQuery } from "dexie-react-hooks";
import { offlineDb } from "./offline-db";
import { getEffectiveOnline, useEffectiveOnline } from "./network-status";
import { useToast } from "@/hooks/use-toast";

let syncInProgress = false;
let rerunRequested = false;

export function useOfflineSync() {
  const isOnline = useEffectiveOnline();
  const [isSyncing, setIsSyncing] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const batchCreate = useBatchCreateInspections();
  const mutateAsyncRef = useRef(batchCreate.mutateAsync);
  mutateAsyncRef.current = batchCreate.mutateAsync;

  const queueCount = useLiveQuery(() => offlineDb.pendingInspections.count(), [], 0);

  const addToQueue = useCallback(async (inspection: InspectionInput) => {
    await offlineDb.pendingInspections.add({
      queuedAt: Date.now(),
      payload: inspection,
    });
  }, []);

  const syncQueue = useCallback(async () => {
    if (!getEffectiveOnline()) return;

    // Acquire the lock synchronously — before any await — so concurrent callers
    // (multiple hook instances, or StrictMode double-effects) cannot both read
    // and push the same queued rows, which would create duplicate server records.
    if (syncInProgress) {
      rerunRequested = true;
      return;
    }
    syncInProgress = true;
    setIsSyncing(true);

    try {
      do {
        rerunRequested = false;

        // Re-check connectivity before each batch: if the network drops (or is
        // forced offline via the dev panel) mid-drain, stop here so rows queued
        // after the toggle are not pushed until connectivity is restored.
        if (!getEffectiveOnline()) break;

        const pending = await offlineDb.pendingInspections.orderBy("queuedAt").toArray();
        if (pending.length === 0) break;

        const ids = pending
          .map((p) => p.id)
          .filter((id): id is number => id !== undefined);
        const inspections = pending.map((p) => p.payload);

        try {
          await mutateAsyncRef.current({ data: { inspections } });
          // Clear only the rows we just synced (by id). Any rows queued during
          // the in-flight push survive and are drained on the next iteration.
          await offlineDb.pendingInspections.bulkDelete(ids);
          queryClient.invalidateQueries({ queryKey: getListInspectionsQueryKey() });
          toast({
            title: "Sync Complete",
            description: `Successfully synced ${inspections.length} inspection${
              inspections.length > 1 ? "s" : ""
            } to the server.`,
          });
        } catch (e) {
          console.error("Sync error", e);
          toast({
            title: "Sync Failed",
            description: "Couldn't sync queued inspections. Will retry automatically.",
            variant: "destructive",
          });
          break;
        }
      } while (rerunRequested || (await offlineDb.pendingInspections.count()) > 0);
    } finally {
      syncInProgress = false;
      setIsSyncing(false);
    }
  }, [queryClient, toast]);

  // Drain the queue on mount and whenever connectivity (real or simulated) is restored.
  useEffect(() => {
    if (isOnline) {
      void syncQueue();
    }
  }, [isOnline, syncQueue]);

  return {
    isOnline,
    queueCount: queueCount ?? 0,
    isSyncing,
    addToQueue,
    syncQueue,
  };
}
