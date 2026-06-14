import { useSyncExternalStore } from "react";

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

export function getEffectiveOnline(): boolean {
  return navigator.onLine;
}

export function useEffectiveOnline(): boolean {
  return useSyncExternalStore(subscribeNetwork, getEffectiveOnline, () => true);
}
