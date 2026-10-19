import { defaultReminder, normalizeReminder } from "./pet/reminderSettings.js";
import { DEFAULT_WEEKDAY, countScheduleDays } from "./calendar.js";
export const STORAGE_KEY = "guardadito:v1";
export const PROVIDERS = ["Nu", "Mercado Pago", "Bitso", "Otra"];
// Before the rename the app saved under this key; copy it once so nobody
// loses their cajitas. The old copy stays as a fallback.
export const LEGACY_STORAGE_KEY = "cajitas:v1";
export function migrateStorageKey(storage) {
  if (storage.getItem(STORAGE_KEY) !== null) return false;
  const legacy = storage.getItem(LEGACY_STORAGE_KEY);
  if (legacy === null) return false;
  storage.setItem(STORAGE_KEY, legacy);
  return true;
}
export const money = (cents) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2,
  }).format(cents / 100);
export const today = () => localDate(new Date());
/** Where a movement came from, as the app names it. */
export const SOURCE_LABEL = {
  manual: "Manual",
  gmail: "Correo",
  guardian: "Confirmado",
};
export function localDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function cents(value) {
  if (!/^\d+(\.\d{1,2})?$/.test(String(value)))
    throw new Error("Usa un monto positivo con hasta dos decimales.");
  const result = Math.round(Number(value) * 100);
  if (!Number.isSafeInteger(result) || result <= 0 || result > 1e11)
    throw new Error("Revisa el monto.");
  return result;
}
export function balance(goal) {
  return goal.entries.reduce((sum, e) => sum + e.cents, 0);
}
/** Did the change from `before` to `after` take this goal from under its
 * target to reaching it? */
export function reachedTarget(before, after, goalId) {
  const was = before.goals.find((g) => g.id === goalId),
    now = after.goals.find((g) => g.id === goalId);
  return Boolean(
    was &&
    now &&
    balance(was) < was.targetCents &&
    balance(now) >= now.targetCents,
  );
}
/**
 * The one way to add a movement (a deposit or, when `cents` is negative, a
 * withdrawal) to a goal. Throws if the result would not be a valid journal;
 * `reachedTarget` says whether it completed the goal. `id` is only passed when
 * the same movement must never be added twice.
 */
export function recordEntry(
  data,
  goalId,
  { cents, at, source = "manual", id = crypto.randomUUID() },
) {
  if (!data.goals.some((goal) => goal.id === goalId))
    throw new Error("Elige una cajita para este movimiento.");
  const next = {
    ...data,
    goals: data.goals.map((goal) =>
      goal.id === goalId
        ? { ...goal, entries: [...goal.entries, { id, cents, at, source }] }
        : goal,
    ),
  };
  validateBackup(next);
  return { data: next, reachedTarget: reachedTarget(data, next, goalId) };
}
/** A goal without a target date never "arrives": it sorts last and is never
 * past due. */
export function unlockTime(date) {
  if (!date) return Infinity;
  return new Date(`${date}T00:00:00`).getTime();
}
/** Nearest target date first; goals without a date go last. */
export function byTargetDate(a, b) {
  const ta = unlockTime(a.unlockDate),
    tb = unlockTime(b.unlockDate);
  return ta === tb ? 0 : ta < tb ? -1 : 1;
}
export function countdown(date, now = Date.now()) {
  if (!date) return "Sin fecha objetivo";
  const seconds = Math.max(0, Math.ceil((unlockTime(date) - now) / 1000));
  if (!seconds) return "¡Compromiso cumplido!";
  const days = Math.floor(seconds / 86400),
    hours = Math.floor((seconds % 86400) / 3600),
    mins = Math.floor((seconds % 3600) / 60);
  return `${days} días · ${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
/** Suggested amount per period, or null for a goal without a target date:
 * there are no periods to split the rest into. Periods are the same calendar
 * dates the reminders use (src/calendar.js), from today until the target day.
 * `weekday` is the reminder's weekday for a weekly rhythm. */
export function plan(
  goal,
  frequency = 7,
  now = Date.now(),
  weekday = DEFAULT_WEEKDAY,
) {
  if (!goal.unlockDate) return null;
  const periods = Math.max(
    1,
    countScheduleDays(frequency, now, unlockTime(goal.unlockDate), weekday),
  );
  return Math.ceil(Math.max(0, goal.targetCents - balance(goal)) / periods);
}
/** An estimate of when a goal would be reached at the pace of its recent
 * recorded savings (last 60 days, at least 14). Never a promise: with no
 * recent net savings there is no estimate and the screen says so. */
export function projection(goal, now = Date.now()) {
  const remaining = Math.max(0, goal.targetCents - balance(goal));
  if (!remaining) return { kind: "done" };
  const DAY = 86400000,
    times = goal.entries.map((e) => Date.parse(e.at)).filter(Number.isFinite);
  if (!times.length) return { kind: "none" };
  const span = Math.min(60 * DAY, Math.max(14 * DAY, now - Math.min(...times))),
    net = goal.entries
      .filter((e) => Date.parse(e.at) >= now - span)
      .reduce((sum, e) => sum + e.cents, 0);
  if (net <= 0) return { kind: "none" };
  const days = Math.ceil(remaining / (net / (span / DAY)));
  if (days > 3650) return { kind: "none" };
  return { kind: "pace", days, date: localDate(new Date(now + days * DAY)) };
}
export function streak(goals, now = new Date()) {
  const days = new Set(
    goals.flatMap((g) =>
      g.entries
        .filter((e) => e.cents > 0)
        .map((e) => localDate(new Date(e.at))),
    ),
  );
  const cursor = new Date(now);
  let count = 0;
  if (!days.has(localDate(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (days.has(localDate(cursor))) {
    count++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return count;
}
export function initialData() {
  return {
    version: 2,
    goals: [],
    importedIds: [],
    assignments: {},
    checkins: [],
    preferences: defaultPreferences(),
  };
}
export const PETS = {
  cat: {
    name: "Cookie",
    label: "Gatito",
    color: "#c98b5b",
    motto: "Miau. Aquí estoy para cuidar tus sueños.",
    // Only for whoever receives Cookie as a gift from their partner.
    special: true,
  },
  pig: {
    name: "Pipo",
    label: "Cerdito",
    color: "#f3c8ce",
    motto: "Un guardadito y un abrazo.",
  },
  cow: {
    name: "Mila",
    label: "Vaquita",
    color: "#d9d5ef",
    motto: "Vamos a tu ritmo, muuuy bien.",
  },
  dog: {
    name: "Taro",
    label: "Shiba",
    color: "#ffb36b",
    motto: "Meneo la cola por cada pasito.",
  },
  otter: {
    name: "Nuri",
    label: "Nutria",
    color: "#c99467",
    motto: "Guardo mi piedrita, y tú tus sueños.",
  },
  bunny: {
    name: "Luna",
    label: "Conejito",
    color: "#eedec7",
    motto: "Pasito a pasito, saltito a saltito.",
  },
  box: {
    name: "Caji",
    label: "Cajita",
    color: "#c8e8bd",
    motto: "Los sueños también necesitan una casita.",
  },
};
/** What a special pet says when nobody personalized it. */
export const PET_WORDS = {
  lines: ["¡Miau!", "Miau miau"],
  loveText: "¡Te quiero mucho!",
};
/** Pets this person can choose: special ones only once they were given. */
export function availablePets(preferences) {
  const given = preferences?.special?.pets ?? [];
  return Object.keys(PETS).filter(
    (key) =>
      !PETS[key].special || given.includes(key) || preferences?.pet === key,
  );
}
/** Words of the current pet: the partner's, or the default ones. */
export function petWords(preferences) {
  const special = preferences?.special;
  return {
    lines: special?.lines?.length ? special.lines : PET_WORDS.lines,
    loveText: special?.loveText || PET_WORDS.loveText,
    motto: special?.motto || PETS[preferences?.pet]?.motto || "",
    from: special?.from || "",
  };
}
function validSpecial(special) {
  if (!special || typeof special !== "object" || Array.isArray(special))
    return undefined;
  const text = (value, max) =>
    typeof value === "string" && value.trim() && value.length <= max
      ? value.trim()
      : "";
  const lines = Array.isArray(special.lines)
    ? special.lines
        .map((l) => text(l, 40))
        .filter(Boolean)
        .slice(0, 8)
    : [];
  const pets = Array.isArray(special.pets)
    ? special.pets.filter((p) => Object.hasOwn(PETS, p))
    : [];
  return {
    from: text(special.from, 40),
    lines,
    loveText: text(special.loveText, 60),
    motto: text(special.motto, 80),
    pets,
  };
}
export function defaultPreferences() {
  return {
    pet: "pig",
    petName: "Pipo",
    accessory: "leaf",
    animations: true,
    reminder: defaultReminder(),
  };
}
export function activeGoals(data) {
  return data.goals.filter((g) => !g.archived);
}
/** The goal the "siguiente pasito" points at: active, unfinished, nearest date. */
export function nextGoal(data) {
  return activeGoals(data)
    .filter((goal) => !isComplete(goal))
    .sort(byTargetDate)[0];
}
export function companionship(data) {
  const dates = new Set([
    ...data.checkins,
    ...data.goals.flatMap((g) =>
      g.entries
        .filter((e) => e.cents > 0)
        .map((e) => localDate(new Date(e.at))),
    ),
  ]);
  const thresholds = [0, 3, 7, 14, 30];
  const level = thresholds.filter((n) => dates.size >= n).length;
  const next = thresholds[level] ?? null;
  return {
    days: dates.size,
    level,
    next,
    progress: next
      ? (dates.size - thresholds[level - 1]) / (next - thresholds[level - 1])
      : 1,
    title: [
      "Una nueva amistad",
      "Cómplices de sueños",
      "Nuestra amistad florece",
      "Pequeños aventureros",
      "Una gran compañía",
    ][level - 1],
  };
}
export function checkIn(data, date = today()) {
  return data.checkins.includes(date)
    ? data
    : { ...data, checkins: [...data.checkins, date].sort() };
}
export function activity(data, { goalId = "", month = "" } = {}) {
  return data.goals
    .filter((g) => !goalId || g.id === goalId)
    .flatMap((g) =>
      g.entries.map((e) => ({
        ...e,
        goalId: g.id,
        goalName: g.name,
        provider: g.provider,
        unlockDate: g.unlockDate,
      })),
    )
    .filter((e) => !month || localDate(new Date(e.at)).startsWith(month))
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}
export function balanceHistory(data, days = 14, now = new Date()) {
  const entries = data.goals.flatMap((g) => g.entries);
  return Array.from({ length: days }, (_, i) => {
    const date = new Date(now);
    date.setDate(date.getDate() - days + i + 1);
    date.setHours(23, 59, 59, 999);
    return {
      date: localDate(date),
      cents: entries
        .filter((e) => Date.parse(e.at) <= date.getTime())
        .reduce((sum, e) => sum + e.cents, 0),
    };
  });
}
export const isComplete = (goal) => balance(goal) >= goal.targetCents;
/**
 * Everything a screen shows about one cajita. `percent` only says 100 once
 * the cajita is complete, so "100 % logrado" never sits next to "Te faltan".
 */
export function goalSummary(goal, now = Date.now()) {
  const saved = balance(goal),
    complete = isComplete(goal),
    progress = Math.min(1, Math.max(0, saved / goal.targetCents)),
    remaining = Math.max(0, goal.targetCents - saved);
  return {
    saved,
    progress,
    percent: complete ? 100 : Math.min(99, Math.round(progress * 100)),
    remaining,
    complete,
    pastDue: !complete && unlockTime(goal.unlockDate) <= now,
    locked: unlockTime(goal.unlockDate) > now,
  };
}
export function activityCSV(data, filters) {
  const text = (value) =>
    '"' +
    (/^[=+@\-\t\r]/.test(String(value).trimStart()) ? "'" : "") +
    String(value).replaceAll('"', '""') +
    '"';
  return (
    "\ufeffFecha,Cajita,App,Tipo,Monto MXN,Origen,Fecha objetivo\r\n" +
    activity(data, filters)
      .map((e) =>
        [
          text(new Date(e.at).toISOString()),
          text(e.goalName),
          text(e.provider),
          text(e.cents > 0 ? "Depósito" : "Retiro"),
          (e.cents / 100).toFixed(2),
          text(SOURCE_LABEL[e.source] ?? "Manual"),
          text(e.unlockDate ?? ""),
        ].join(","),
      )
      .join("\r\n")
  );
}
// The target date is optional; older backups always carry one.
const noDate = (value) => value === undefined || value === null || value === "";
function validDate(value) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    localDate(new Date(`${value}T12:00:00`)) === value
  );
}
export function validMovementDate(value) {
  if (typeof value !== "string") return false;
  const match =
    /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})?)?$/.exec(
      value,
    );
  const timestamp = Date.parse(value);
  return Boolean(
    match &&
    validDate(match[1]) &&
    (match[2] === undefined ||
      (Number(match[2]) < 24 &&
        Number(match[3]) < 60 &&
        Number(match[4] ?? 0) < 60)) &&
    Number.isFinite(timestamp) &&
    localDate(new Date(timestamp)) <= today(),
  );
}
function validateHistory(entries) {
  let sum = 0;
  for (const entry of [...entries].sort(
    (a, b) => Date.parse(a.at) - Date.parse(b.at),
  )) {
    sum += entry.cents;
    if (!Number.isSafeInteger(sum) || sum < 0)
      throw new Error(
        "El historial contiene un saldo inválido en alguna fecha.",
      );
  }
}
export function validateBackup(data) {
  if (
    !data ||
    ![1, 2].includes(data.version) ||
    !Array.isArray(data.goals) ||
    data.goals.length > 200 ||
    !Array.isArray(data.importedIds) ||
    !data.assignments ||
    typeof data.assignments !== "object" ||
    Array.isArray(data.assignments)
  )
    throw new Error("Este archivo no es un respaldo compatible de Guardadito.");
  if (
    data.preferences !== undefined &&
    (!data.preferences ||
      typeof data.preferences !== "object" ||
      Array.isArray(data.preferences))
  )
    throw new Error("Las preferencias del respaldo no son válidas.");
  const preferences = {
    ...defaultPreferences(),
    ...data.preferences,
    reminder: normalizeReminder(data.preferences?.reminder),
  };
  if (
    !Object.hasOwn(PETS, preferences.pet) ||
    typeof preferences.petName !== "string" ||
    !preferences.petName.trim() ||
    preferences.petName.length > 32 ||
    !["leaf", "bow", "scarf", "star"].includes(preferences.accessory) ||
    typeof preferences.animations !== "boolean"
  )
    throw new Error("Las preferencias del respaldo no son válidas.");
  const checkins = data.checkins ?? [];
  if (
    !Array.isArray(checkins) ||
    checkins.length > 4000 ||
    checkins.some((d) => !validDate(d))
  )
    throw new Error("El historial de compañía no es válido.");
  const ids = new Set();
  for (const g of data.goals) {
    if (
      !g ||
      typeof g.id !== "string" ||
      ids.has(g.id) ||
      typeof g.name !== "string" ||
      !g.name.trim() ||
      g.name.length > 80 ||
      !Number.isSafeInteger(g.targetCents) ||
      g.targetCents <= 0 ||
      g.targetCents > 1e11 ||
      (!noDate(g.unlockDate) && !validDate(g.unlockDate)) ||
      !PROVIDERS.includes(g.provider) ||
      !Array.isArray(g.entries) ||
      g.entries.length > 10000 ||
      !["star", "flower", "cloud"].includes(g.icon) ||
      (g.frequency !== undefined && ![7, 15, 30].includes(g.frequency)) ||
      (g.archived !== undefined && typeof g.archived !== "boolean")
    )
      throw new Error("Hay una cajita con datos inválidos.");
    ids.add(g.id);
    const entryIds = new Set();
    for (const e of g.entries) {
      if (
        !e ||
        typeof e.id !== "string" ||
        entryIds.has(e.id) ||
        !Number.isSafeInteger(e.cents) ||
        e.cents === 0 ||
        Math.abs(e.cents) > 1e11 ||
        !validMovementDate(e.at) ||
        (e.source !== undefined &&
          !["manual", "gmail", "guardian"].includes(e.source))
      )
        throw new Error("Hay un movimiento inválido.");
      entryIds.add(e.id);
    }
    validateHistory(g.entries);
  }
  const trash = validTrash(data.trash);
  if (
    data.importedIds.length > 50000 ||
    data.importedIds.some((id) => typeof id !== "string")
  )
    throw new Error("El registro de correos es inválido.");
  return {
    version: 2,
    savedAt:
      Number.isSafeInteger(data.savedAt) && data.savedAt >= 0
        ? data.savedAt
        : 0,
    preferences: {
      pet: preferences.pet,
      petName: preferences.petName,
      accessory: preferences.accessory,
      animations: preferences.animations,
      reminder: preferences.reminder,
      ...(validSpecial(data.preferences?.special) && {
        special: validSpecial(data.preferences.special),
      }),
    },
    checkins: [...new Set(checkins)].sort(),
    goals: data.goals.map((g) => ({
      id: g.id,
      name: g.name,
      targetCents: g.targetCents,
      unlockDate: noDate(g.unlockDate) ? null : g.unlockDate,
      provider: g.provider,
      icon: g.icon,
      frequency: g.frequency ?? 7,
      archived: g.archived ?? false,
      entries: g.entries.map((e) => ({
        id: e.id,
        cents: e.cents,
        at: e.at,
        source: ["gmail", "guardian"].includes(e.source) ? e.source : "manual",
      })),
    })),
    importedIds: [...new Set(data.importedIds)],
    ...(trash.length && { trash }),
    assignments: Object.fromEntries(
      Object.entries(data.assignments).filter(
        ([k, v]) =>
          /^(nu|mp)-deposit-v1$/.test(k) && typeof v === "string" && ids.has(v),
      ),
    ),
  };
}
// Deleted movements wait here 30 days, like Splitwise's restore.
export const TRASH_DAYS = 30;
const TRASH_MAX = 50;
function validTrash(trash) {
  if (trash === undefined) return [];
  if (!Array.isArray(trash) || trash.length > TRASH_MAX)
    throw new Error("La papelera es inválida.");
  for (const item of trash)
    if (
      !item ||
      typeof item.goalId !== "string" ||
      typeof item.goalName !== "string" ||
      !Number.isSafeInteger(item.deletedAt) ||
      !item.entry ||
      typeof item.entry.id !== "string" ||
      !Number.isSafeInteger(item.entry.cents) ||
      item.entry.cents === 0 ||
      !validMovementDate(item.entry.at)
    )
      throw new Error("La papelera es inválida.");
  return trash.map(({ goalId, goalName, deletedAt, entry }) => ({
    goalId,
    goalName: goalName.slice(0, 80),
    deletedAt,
    entry: { id: entry.id, cents: entry.cents, at: entry.at, source: "manual" },
  }));
}
/** What is still in the trash, newest first, without expired items. */
export function trashItems(data, now = Date.now()) {
  return (data.trash ?? [])
    .filter((item) => now - item.deletedAt < TRASH_DAYS * 86400000)
    .sort((a, b) => b.deletedAt - a.deletedAt);
}
export function restoreEntry(data, entryId, now = Date.now()) {
  const item = trashItems(data, now).find((t) => t.entry.id === entryId);
  const goal = item && data.goals.find((g) => g.id === item.goalId);
  if (!goal) throw new Error("Esa cajita ya no existe; no se puede restaurar.");
  const next = {
    ...data,
    trash: (data.trash ?? []).filter((t) => t.entry.id !== entryId),
    goals: data.goals.map((g) =>
      g.id === goal.id && !g.entries.some((e) => e.id === entryId)
        ? { ...g, entries: [...g.entries, item.entry] }
        : g,
    ),
  };
  try {
    validateBackup(next);
  } catch {
    throw new Error(
      "Restaurarlo dejaría la cajita en negativo. Revisa tus retiros primero.",
    );
  }
  return next;
}
function changeManualEntry(data, goalId, entryId, change) {
  const goal = data.goals.find((item) => item.id === goalId);
  const entry = goal?.entries.find((item) => item.id === entryId);
  if (!entry || (entry.source !== undefined && entry.source !== "manual"))
    throw new Error("Solo puedes corregir o eliminar movimientos manuales.");
  const next = {
    ...data,
    goals: data.goals.map((item) =>
      item.id === goalId
        ? {
            ...item,
            entries: item.entries.flatMap((movement) => {
              if (movement.id !== entryId) return [movement];
              const updated = change(movement);
              return updated ? [updated] : [];
            }),
          }
        : item,
    ),
  };
  validateBackup(next);
  return next;
}
export function correctManualEntry(data, goalId, entryId, { cents, at }) {
  return changeManualEntry(data, goalId, entryId, (entry) => ({
    ...entry,
    cents,
    at,
  }));
}
export function removeManualEntry(data, goalId, entryId, now = Date.now()) {
  const goal = data.goals.find((g) => g.id === goalId);
  const entry = goal?.entries.find((e) => e.id === entryId);
  const next = changeManualEntry(data, goalId, entryId, () => null);
  return {
    ...next,
    trash: [
      { goalId, goalName: goal.name, deletedAt: now, entry: { ...entry } },
      ...trashItems(data, now).filter((t) => t.entry.id !== entryId),
    ].slice(0, TRASH_MAX),
  };
}
export function estimate(principalCents, annualRate, days) {
  return Math.round((((principalCents * annualRate) / 100) * days) / 365);
}
