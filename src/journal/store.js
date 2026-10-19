import { initialData, validateBackup } from "../domain.js";

const STORAGE_ERRORS = ["QuotaExceededError", "SecurityError"];

/**
 * Keeps the journal of this device: the one copy in storage, the newest-wins
 * guard against stale writes, and the listeners that must hear about changes.
 *
 * `storage` is `{ read(), write(raw), watch?(onChange) }`; `replica(raw)` is an
 * optional second copy (the native app keeps one) that may fail on its own.
 * Failures come back as `{ ok: false, reason }`; wording belongs to the caller.
 *
 * Events: "saved" (a change worth sending to the account), "replaced" (a copy
 * from the account), "external" / "external-invalid" (another tab wrote), and
 * "replica-failed". `recovery` is null, "unreadable" or "external": while set,
 * `save` refuses so the original data is not overwritten.
 */
export function createJournalStore({ storage, replica, now = Date.now }) {
  const listeners = new Set();
  let data, lastRaw, recovery, snapshot;

  function parse(raw) {
    return raw ? validateBackup(JSON.parse(raw)) : initialData();
  }
  function publish(event, changed = true) {
    if (changed) snapshot = { data, recovery };
    for (const listener of listeners) listener(event);
  }
  function replicate(raw, quiet) {
    if (!replica) return;
    Promise.resolve(replica(raw)).catch(() => {
      if (!quiet) publish({ type: "replica-failed" }, false);
    });
  }
  function failure(error) {
    return STORAGE_ERRORS.includes(error?.name)
      ? { ok: false, reason: "quota" }
      : { ok: false, reason: "invalid", message: error?.message };
  }
  function commit(next) {
    const saved = {
      ...validateBackup(next),
      savedAt: Math.max(now(), (data.savedAt ?? 0) + 1),
    };
    const raw = JSON.stringify(saved);
    storage.write(raw);
    lastRaw = raw;
    data = saved;
    recovery = null;
    replicate(raw, false);
    return saved;
  }

  try {
    lastRaw = null;
    lastRaw = storage.read();
    data = parse(lastRaw);
    recovery = null;
  } catch {
    data = initialData();
    recovery = "unreadable";
  }
  snapshot = { data, recovery };

  const unwatch = storage.watch?.(() => {
    let raw;
    try {
      raw = storage.read();
      const next = parse(raw);
      lastRaw = raw;
      data = next;
      recovery = null;
      publish({ type: "external", data });
    } catch {
      recovery = "external";
      publish({ type: "external-invalid" });
    }
  });

  return {
    get: () => data,
    getSnapshot: () => snapshot,
    /** The stored text as it is now, even when it cannot be read as a journal. */
    readRaw: () => {
      try {
        return storage.read();
      } catch {
        return null;
      }
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    /** Save a change made from the current journal; refuses stale changes. */
    save(next) {
      if (recovery) return { ok: false, reason: "recovery" };
      try {
        if (
          (next.savedAt ?? 0) !== (data.savedAt ?? 0) ||
          storage.read() !== lastRaw
        )
          return { ok: false, reason: "stale" };
        const saved = commit(next);
        publish({ type: "saved", data: saved });
        return { ok: true };
      } catch (error) {
        return failure(error);
      }
    },
    /**
     * Take a whole journal in place of the current one, skipping the guard.
     * `remote: true` is a copy that came from the account: kept as it is and
     * not sent back. Otherwise it is a restore and counts as a new save.
     */
    replace(next, { remote = false } = {}) {
      if (remote) {
        const raw = JSON.stringify(next);
        try {
          storage.write(raw);
        } catch {
          /* The account keeps the copy; this device retries on its next save. */
        }
        lastRaw = raw;
        data = next;
        recovery = null;
        replicate(raw, true);
        publish({ type: "replaced", data });
        return { ok: true };
      }
      try {
        const saved = commit(next);
        publish({ type: "saved", data: saved });
        return { ok: true };
      } catch (error) {
        return failure(error);
      }
    },
    dispose() {
      unwatch?.();
      listeners.clear();
    },
  };
}
