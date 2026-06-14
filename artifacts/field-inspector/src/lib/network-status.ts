import { useSyncExternalStore } from "react";

export type ForcedStatus = "online" | "offline" | null;

let forced: ForcedStatus = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

if (typeof window !== "undefined") {
  window.addEventListener("online", emit);
  window.addEventListener("offline", emit);
}

export function subscribeNetwork(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Effective connectivity: a forced override (for testing) wins over the real navigator status. */
export function getEffectiveOnline(): boolean {
  if (forced === "online") return true;
  if (forced === "offline") return false;
  return navigator.onLine;
}

export function getForcedStatus(): ForcedStatus {
  return forced;
}

export function setForcedStatus(status: ForcedStatus): void {
  forced = status;
  emit();
}

export function useEffectiveOnline(): boolean {
  return useSyncExternalStore(subscribeNetwork, getEffectiveOnline, () => true);
}

export function useForcedStatus(): ForcedStatus {
  return useSyncExternalStore(subscribeNetwork, getForcedStatus, () => null);
}
