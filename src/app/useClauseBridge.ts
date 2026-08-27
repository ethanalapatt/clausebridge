"use client";

import { createContext, useContext, useSyncExternalStore } from "react";

import type { ClauseBridgeStore } from "@/app/store";
import type { Session } from "@/core/state";

export const StoreContext = createContext<ClauseBridgeStore | null>(null);

export function useStore(): ClauseBridgeStore {
  const store = useContext(StoreContext);
  if (store === null) {
    throw new Error("useStore must be used inside the ClauseBridge store provider.");
  }
  return store;
}

export function useSession(): Session {
  const store = useStore();
  // Server snapshot is the same object, so the first paint matches the markup.
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}
