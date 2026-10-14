export const STORAGE_KEY = "cajitas:v1";
export const money = (cents) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2,
  }).format(cents / 100);
export const today = () => localDate(new Date());
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
export function unlockTime(date) {
  return new Date(`${date}T00:00:00`).getTime();
}
export function countdown(date, now = Date.now()) {
  const seconds = Math.max(0, Math.ceil((unlockTime(date) - now) / 1000));
  if (!seconds) return "¡Compromiso cumplido!";
  const days = Math.floor(seconds / 86400),
    hours = Math.floor((seconds % 86400) / 3600),
    mins = Math.floor((seconds % 3600) / 60);
  return `${days} días · ${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
export function plan(goal, frequency = 7, now = Date.now()) {
  const days = Math.max(
    0,
    Math.ceil((unlockTime(goal.unlockDate) - now) / 86400000),
  );
  const periods = Math.max(1, Math.ceil(days / frequency));
  return Math.ceil(Math.max(0, goal.targetCents - balance(goal)) / periods);
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
export function defaultPreferences() {
  return {
    pet: "box",
    petName: "Caji",
    accessory: "leaf",
    animations: true,
    reminder: { enabled: false, day: 5, time: "18:00" },
  };
}
export function activeGoals(data) {
  return data.goals.filter((g) => !g.archived);
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
export function goalStatus(goal, now = Date.now()) {
  const remaining = Math.max(0, goal.targetCents - balance(goal));
  return {
    complete: remaining === 0,
    remaining,
    pastDue: remaining > 0 && unlockTime(goal.unlockDate) <= now,
  };
}
export function activityCSV(data, filters) {
  const text = (value) =>
    '"' +
    (/^[=+@\-\t\r]/.test(String(value).trimStart()) ? "'" : "") +
    String(value).replaceAll('"', '""') +
    '"';
  return (
    "\ufeffFecha,Cajita,App,Tipo,Monto MXN,Origen\r\n" +
    activity(data, filters)
      .map((e) =>
        [
          text(new Date(e.at).toISOString()),
          text(e.goalName),
          text(e.provider),
          text(e.cents > 0 ? "Depósito" : "Retiro"),
          (e.cents / 100).toFixed(2),
          text(e.source === "gmail" ? "Correo" : "Manual"),
        ].join(","),
      )
      .join("\r\n")
  );
}
function validDate(value) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    localDate(new Date(`${value}T12:00:00`)) === value
  );
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
    throw new Error("Este archivo no es un respaldo compatible de Cajitas.");
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
    reminder: {
      ...defaultPreferences().reminder,
      ...data.preferences?.reminder,
    },
  };
  if (
    !Object.hasOwn(PETS, preferences.pet) ||
    typeof preferences.petName !== "string" ||
    !preferences.petName.trim() ||
    preferences.petName.length > 32 ||
    !["leaf", "bow", "scarf", "star"].includes(preferences.accessory) ||
    typeof preferences.animations !== "boolean" ||
    typeof preferences.reminder.enabled !== "boolean" ||
    !Number.isInteger(preferences.reminder.day) ||
    preferences.reminder.day < 0 ||
    preferences.reminder.day > 6 ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(preferences.reminder.time)
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
      typeof g.id !== "string" ||
      ids.has(g.id) ||
      typeof g.name !== "string" ||
      !g.name.trim() ||
      g.name.length > 80 ||
      !Number.isSafeInteger(g.targetCents) ||
      g.targetCents <= 0 ||
      g.targetCents > 1e11 ||
      !validDate(g.unlockDate) ||
      !["Nu", "Mercado Pago", "Bitso", "Otra"].includes(g.provider) ||
      !Array.isArray(g.entries) ||
      g.entries.length > 10000 ||
      !["star", "flower", "cloud"].includes(g.icon) ||
      (g.frequency !== undefined && ![7, 15, 30].includes(g.frequency)) ||
      (g.archived !== undefined && typeof g.archived !== "boolean")
    )
      throw new Error("Hay una cajita con datos inválidos.");
    ids.add(g.id);
    const entryIds = new Set();
    let sum = 0;
    for (const e of g.entries) {
      if (
        typeof e.id !== "string" ||
        entryIds.has(e.id) ||
        !Number.isSafeInteger(e.cents) ||
        e.cents === 0 ||
        Math.abs(e.cents) > 1e11 ||
        typeof e.at !== "string" ||
        !Number.isFinite(Date.parse(e.at))
      )
        throw new Error("Hay un movimiento inválido.");
      entryIds.add(e.id);
      sum += e.cents;
      if (!Number.isSafeInteger(sum) || sum < 0)
        throw new Error("El respaldo contiene un saldo inválido.");
    }
  }
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
      reminder: {
        enabled: preferences.reminder.enabled,
        day: preferences.reminder.day,
        time: preferences.reminder.time,
      },
    },
    checkins: [...new Set(checkins)].sort(),
    goals: data.goals.map((g) => ({
      id: g.id,
      name: g.name,
      targetCents: g.targetCents,
      unlockDate: g.unlockDate,
      provider: g.provider,
      icon: g.icon,
      frequency: g.frequency ?? 7,
      archived: g.archived ?? false,
      entries: g.entries.map((e) => ({
        id: e.id,
        cents: e.cents,
        at: e.at,
        source: e.source === "gmail" ? "gmail" : "manual",
      })),
    })),
    importedIds: [...new Set(data.importedIds)],
    assignments: Object.fromEntries(
      Object.entries(data.assignments).filter(
        ([k, v]) =>
          /^(nu|mp)-deposit-v1$/.test(k) && typeof v === "string" && ids.has(v),
      ),
    ),
  };
}
export function addReceipt(data, receipt, goalId) {
  if (
    data.importedIds.includes(receipt.id) ||
    !data.goals.some((g) => g.id === goalId)
  )
    return data;
  if (!Number.isSafeInteger(receipt.amountCents) || receipt.amountCents <= 0)
    throw new Error("Monto de correo inválido.");
  return {
    ...data,
    importedIds: [...data.importedIds, receipt.id],
    goals: data.goals.map((g) =>
      g.id === goalId
        ? {
            ...g,
            entries: [
              ...g.entries,
              {
                id: crypto.randomUUID(),
                cents: receipt.amountCents,
                at: receipt.at,
                source: "gmail",
              },
            ],
          }
        : g,
    ),
  };
}
export function estimate(principalCents, annualRate, days) {
  return Math.round((((principalCents * annualRate) / 100) * days) / 365);
}
