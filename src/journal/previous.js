import { hasContent } from "../cloud/sync.js";
import { validateBackup } from "../domain.js";

// The cajitas this phone had right before a copy from the account replaced
// them. If that copy was older or wrong, Respaldo can bring these back.
export const PREVIOUS_KEY = "guardadito:previous";

function area(storage) {
  try {
    return storage ?? globalThis.localStorage;
  } catch {
    return null;
  }
}

/** Keeps `data` unless it is empty or the same cajitas as `next`. */
export function keepPrevious(data, next, { storage, now = Date.now } = {}) {
  if (!hasContent(data)) return false;
  if (JSON.stringify(data.goals) === JSON.stringify(next?.goals)) return false;
  try {
    area(storage)?.setItem(PREVIOUS_KEY, JSON.stringify({ at: now(), data }));
    return true;
  } catch {
    // No room for a second copy: the account still has the newest one.
    return false;
  }
}

/** `{ at, data }` or null when there is none or it cannot be read. */
export function readPrevious(storage) {
  try {
    const saved = JSON.parse(area(storage)?.getItem(PREVIOUS_KEY) ?? "null");
    if (!saved || typeof saved.at !== "number") return null;
    return { at: saved.at, data: validateBackup(saved.data) };
  } catch {
    return null;
  }
}

export function forgetPrevious(storage) {
  try {
    area(storage)?.removeItem(PREVIOUS_KEY);
  } catch {
    /* Nothing to forget. */
  }
}
