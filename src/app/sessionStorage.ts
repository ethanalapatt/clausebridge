"use client";

import { PERSISTENCE_KEY, deserializeSession } from "@/core/persistence";
import type { Session } from "@/core/state";
import type { SessionStorage } from "@/app/store";

/**
 * `localStorage` access, guarded.
 *
 * Every entry point here can throw rather than return: Safari's private mode
 * historically threw on write, and browsers configured to block site data throw
 * on plain property access. Reads therefore degrade to "no saved session" and
 * writes degrade to "not saved", which is exactly the behaviour the store's
 * best-effort contract expects.
 */

function storageOrNull(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

export const browserSessionStorage: SessionStorage = {
  write(payload) {
    storageOrNull()?.setItem(PERSISTENCE_KEY, payload);
  },
  clear() {
    storageOrNull()?.removeItem(PERSISTENCE_KEY);
  },
};

/** Reads a previously saved session, or null when there is nothing usable. */
export function loadPersistedSession(): Session | null {
  try {
    return deserializeSession(storageOrNull()?.getItem(PERSISTENCE_KEY) ?? null);
  } catch {
    return null;
  }
}
