import { localDate, recordEntry, today, validateBackup } from "../domain.js";

function validateReceipt(receipt) {
  if (
    !receipt ||
    typeof receipt.id !== "string" ||
    !/^local-email:[a-f0-9]{64}$/.test(receipt.id)
  )
    throw new Error("El identificador del correo local no es válido.");
  if (!["Nu", "Mercado Pago", "Bitso", "Otra"].includes(receipt.provider))
    throw new Error("Elige la app de la cajita para este correo.");
  if (
    !Number.isSafeInteger(receipt.amountCents) ||
    receipt.amountCents <= 0 ||
    receipt.amountCents > 1e11
  )
    throw new Error("Revisa el monto del correo local.");
  const match =
    typeof receipt.at === "string" &&
    /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})?)?$/.exec(
      receipt.at,
    );
  const timestamp = Date.parse(receipt.at);
  if (
    !match ||
    Number(match[2]) < 1 ||
    Number(match[2]) > 12 ||
    Number(match[3]) < 1 ||
    Number(match[3]) >
      new Date(Date.UTC(Number(match[1]), Number(match[2]), 0)).getUTCDate() ||
    Number(match[4] ?? 0) > 23 ||
    Number(match[5] ?? 0) > 59 ||
    Number(match[6] ?? 0) > 59 ||
    !Number.isFinite(timestamp) ||
    localDate(new Date(timestamp)) > today()
  )
    throw new Error("La fecha del correo local no es válida o es futura.");
}

function matches(data, receipt) {
  if (data.importedIds.includes(receipt.id)) return [];
  const receiptDay = localDate(new Date(receipt.at));
  return data.goals
    .filter((goal) => goal.provider === receipt.provider)
    .flatMap((goal) =>
      goal.entries
        .filter(
          (entry) =>
            entry.cents > 0 &&
            entry.cents === receipt.amountCents &&
            localDate(new Date(entry.at)) === receiptDay,
        )
        .map((entry) => ({
          goalId: goal.id,
          goalName: goal.name,
          entryId: entry.id,
          at: entry.at,
          source: entry.source ?? "manual",
          archived: Boolean(goal.archived),
        })),
    );
}

/** Find every existing positive movement, including Gmail and archived goals. */
export function possibleLocalMatches(data, receipt) {
  validateReceipt(receipt);
  validateBackup(data);
  return matches(data, receipt);
}

/** Save only after human review. Matching acknowledges the file without
 * rewriting the existing movement, preserving its identity and history. */
export function applyLocalReceipt(
  data,
  receipt,
  { goalId, match, allowDuplicate = false } = {},
) {
  validateReceipt(receipt);
  validateBackup(data);
  if (data.importedIds.includes(receipt.id)) return data;
  const candidates = matches(data, receipt);
  if (match) {
    if (
      !candidates.some(
        (candidate) =>
          candidate.goalId === match.goalId &&
          candidate.entryId === match.entryId,
      )
    )
      throw new Error(
        "Elige un movimiento existente del mismo monto, app y día.",
      );
    const next = { ...data, importedIds: [...data.importedIds, receipt.id] };
    validateBackup(next);
    return next;
  }
  if (candidates.length && allowDuplicate !== true)
    throw new Error(
      "Elige el movimiento que corresponde al correo o confirma que es un depósito distinto.",
    );
  const goal = data.goals.find((item) => item.id === goalId);
  if (!goal || goal.archived || goal.provider !== receipt.provider)
    throw new Error("Elige una cajita activa de la misma app del correo.");
  return recordEntry(
    { ...data, importedIds: [...data.importedIds, receipt.id] },
    goal.id,
    { cents: receipt.amountCents, at: receipt.at, source: "manual" },
  ).data;
}
