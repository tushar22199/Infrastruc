import { useSyncExternalStore } from "react";

/**
 * Gates the temporary Developer Testing Panel. The panel is hidden by default and
 * becomes available only when EITHER:
 *  - the build/runtime env exposes `VITE_DEV_MODE=true`, OR
 *  - a developer performs the "secret knock": 5 consecutive clicks on the sidebar
 *    logo (each within CLICK_WINDOW_MS of the previous one).
 */
const ENV_ENABLED = import.meta.env.VITE_DEV_MODE === "true";

const REQUIRED_CLICKS = 5;
const CLICK_WINDOW_MS = 1500;

let unlocked = ENV_ENABLED;
let clickCount = 0;
let lastClickAt = 0;

const listeners = new Set<() => void>();
function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function isDevPanelEnabled(): boolean {
  return unlocked;
}

export function useDevPanelEnabled(): boolean {
  return useSyncExternalStore(subscribe, isDevPanelEnabled, () => ENV_ENABLED);
}

/**
 * Register a click on the logo. Returns the unlock result so callers can give
 * subtle feedback. Once unlocked (here or via env), further clicks are no-ops.
 */
export function registerLogoClick(): { unlocked: boolean; justUnlocked: boolean; remaining: number } {
  if (unlocked) {
    return { unlocked: true, justUnlocked: false, remaining: 0 };
  }

  const now = Date.now();
  // Reset the streak if the gap since the last click exceeded the window.
  if (now - lastClickAt > CLICK_WINDOW_MS) {
    clickCount = 0;
  }
  lastClickAt = now;
  clickCount += 1;

  if (clickCount >= REQUIRED_CLICKS) {
    unlocked = true;
    clickCount = 0;
    emit();
    return { unlocked: true, justUnlocked: true, remaining: 0 };
  }

  return { unlocked: false, justUnlocked: false, remaining: REQUIRED_CLICKS - clickCount };
}
