import { useState, useEffect, useCallback, useRef } from "react";
import { useBatchCreateInspections, InspectionInput } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

const QUEUE_KEY = "pending_inspections";

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [queueCount, setQueueCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const { toast } = useToast();
  
  const batchCreate = useBatchCreateInspections();
  const mutationFnRef = useRef(batchCreate.mutate);
  mutationFnRef.current = batchCreate.mutate;

  const updateQueueCount = useCallback(() => {
    try {
      const q = JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
      setQueueCount(q.length);
    } catch {
      setQueueCount(0);
    }
  }, []);

  const addToQueue = useCallback((inspection: InspectionInput) => {
    try {
      const q = JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
      q.push(inspection);
      localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
      updateQueueCount();
      return true;
    } catch (e) {
      console.error("Failed to queue inspection", e);
      return false;
    }
  }, [updateQueueCount]);

  const syncQueue = useCallback(() => {
    if (!navigator.onLine) return;
    
    try {
      const q = JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]") as InspectionInput[];
      if (q.length === 0) return;

      setIsSyncing(true);
      
      mutationFnRef.current({ data: { inspections: q } }, {
        onSuccess: () => {
          localStorage.removeItem(QUEUE_KEY);
          updateQueueCount();
          toast({
            title: "Sync Complete",
            description: `Successfully synced ${q.length} inspections to the server.`,
            variant: "default"
          });
        },
        onError: () => {
          toast({
            title: "Sync Failed",
            description: "Failed to sync background data. Will try again later.",
            variant: "destructive"
          });
        },
        onSettled: () => {
          setIsSyncing(false);
        }
      });
      
    } catch (e) {
      console.error("Sync error", e);
      setIsSyncing(false);
    }
  }, [toast, updateQueueCount]);

  useEffect(() => {
    updateQueueCount();
    
    const handleOnline = () => {
      setIsOnline(true);
      syncQueue();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    
    // Initial sync check if online
    if (navigator.onLine) {
      syncQueue();
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [syncQueue, updateQueueCount]);

  return {
    isOnline,
    queueCount,
    isSyncing,
    addToQueue,
    syncQueue
  };
}
