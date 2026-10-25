// The last errors the app ran into on this device, so a person can send them
// with a report. Only the message and where it happened: never their data.
export const ERROR_LOG_KEY = "guardadito:errors";
const MAX_ERRORS = 20;

function area(storage) {
  try {
    return storage ?? globalThis.localStorage;
  } catch {
    return null;
  }
}

export function readErrors(storage) {
  try {
    const list = JSON.parse(area(storage)?.getItem(ERROR_LOG_KEY) ?? "[]");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function logError(error, where = "app", { storage, now = Date.now } = {}) {
  const message = String(error?.message ?? error ?? "Error").slice(0, 300);
  const entry = { at: now(), where, message };
  try {
    const list = [...readErrors(storage), entry].slice(-MAX_ERRORS);
    area(storage)?.setItem(ERROR_LOG_KEY, JSON.stringify(list));
  } catch {
    /* A full or blocked storage only loses the log, never the cajitas. */
  }
  return entry;
}

export function clearErrors(storage) {
  try {
    area(storage)?.removeItem(ERROR_LOG_KEY);
  } catch {
    /* Nothing to clear. */
  }
}

/** Remembers errors nobody caught, from scripts and from promises. */
export function listenForErrors(target = window) {
  target.addEventListener("error", (event) =>
    logError(event.error ?? event.message, "window"),
  );
  target.addEventListener("unhandledrejection", (event) =>
    logError(event.reason, "promise"),
  );
}
