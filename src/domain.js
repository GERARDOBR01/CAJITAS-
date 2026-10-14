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
  return { version: 1, goals: [], importedIds: [], assignments: {} };
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
    data.version !== 1 ||
    !Array.isArray(data.goals) ||
    data.goals.length > 200 ||
    !Array.isArray(data.importedIds) ||
    !data.assignments ||
    typeof data.assignments !== "object" ||
    Array.isArray(data.assignments)
  )
    throw new Error("Este archivo no es un respaldo compatible de Cajitas.");
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
      !["star", "flower", "cloud"].includes(g.icon)
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
    version: 1,
    goals: data.goals.map((g) => ({
      id: g.id,
      name: g.name,
      targetCents: g.targetCents,
      unlockDate: g.unlockDate,
      provider: g.provider,
      icon: g.icon,
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
