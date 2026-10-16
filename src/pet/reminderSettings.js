// Reminder preferences live in the backup, so their shape is validated here
// without importing the rest of the domain (domain.js depends on this file).
import { DEFAULT_WEEKDAY } from "../calendar.js";
export const FREQUENCIES = ["weekly", "biweekly", "monthly"];
export const FREQUENCY_DAYS = { weekly: 7, biweekly: 15, monthly: 30 };
export const FREQUENCY_LABEL = {
  weekly: "cada semana",
  biweekly: "cada quincena",
  monthly: "cada mes",
};
// Quiet hours: nothing between 22:00 and 08:00.
export const QUIET_START = "22:00";
export const QUIET_END = "08:00";

export function defaultReminder() {
  return {
    enabled: false,
    frequency: "biweekly",
    day: DEFAULT_WEEKDAY,
    time: "09:00",
    since: null,
    ignored: 0,
    recent: [],
  };
}

export function allowedTime(time) {
  return (
    /^([01]\d|2[0-3]):[0-5]\d$/.test(time) &&
    time >= QUIET_END &&
    time < QUIET_START
  );
}

function validInstant(value) {
  return (
    value === null ||
    (typeof value === "string" &&
      /^\d{4}-\d{2}-\d{2}T/.test(value) &&
      Number.isFinite(Date.parse(value)))
  );
}

/** Returns a clean reminder or throws when a stored value is unusable.
 * Older backups (weekly reminder at any hour) migrate without losing intent:
 * a time inside quiet hours moves to the nearest allowed edge. */
export function normalizeReminder(raw) {
  const base = defaultReminder();
  if (raw !== undefined && (!raw || typeof raw !== "object"))
    throw new Error("Las preferencias del respaldo no son válidas.");
  const legacy = raw && raw.frequency === undefined;
  const next = {
    ...base,
    ...(legacy ? { frequency: "weekly" } : {}),
    ...raw,
  };
  if (
    typeof next.time === "string" &&
    /^([01]\d|2[0-3]):[0-5]\d$/.test(next.time)
  ) {
    if (next.time < QUIET_END) next.time = QUIET_END;
    else if (next.time >= QUIET_START) next.time = "21:30";
  }
  if (
    typeof next.enabled !== "boolean" ||
    !FREQUENCIES.includes(next.frequency) ||
    !Number.isInteger(next.day) ||
    next.day < 0 ||
    next.day > 6 ||
    !allowedTime(next.time) ||
    !validInstant(next.since) ||
    !Number.isInteger(next.ignored) ||
    next.ignored < 0 ||
    next.ignored > 100 ||
    !Array.isArray(next.recent) ||
    next.recent.length > 20 ||
    next.recent.some((id) => typeof id !== "string" || id.length > 40)
  )
    throw new Error("Las preferencias del respaldo no son válidas.");
  return {
    enabled: next.enabled,
    frequency: next.frequency,
    day: next.day,
    time: next.time,
    since: next.since,
    ignored: next.ignored,
    recent: next.recent.slice(-5),
  };
}
