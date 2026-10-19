import { STORAGE_KEY } from "../domain.js";
import { persistSavings } from "../platform.js";
import { createJournalStore } from "./store.js";
import { webStorage } from "./webStorage.js";

let instance;
/** Created on first use, after `hydrateSavings` has put the newest copy in place. */
export function journal() {
  return (instance ??= createJournalStore({
    storage: webStorage(STORAGE_KEY),
    replica: persistSavings,
  }));
}
