import { useSyncExternalStore } from "react";

/** `{ data, recovery }` of a journal store, re-rendering on every change. */
export function useJournal(store) {
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
}
