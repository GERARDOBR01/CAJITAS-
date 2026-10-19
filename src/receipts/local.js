import { validateBackup } from "../domain.js";
import {
  PROVIDERS,
  findMatches,
  markSeen,
  registerDeposit,
  validAmount,
  validMoment,
} from "./kernel.js";

function validateReceipt(receipt) {
  if (
    !receipt ||
    typeof receipt.id !== "string" ||
    !/^local-email:[a-f0-9]{64}$/.test(receipt.id)
  )
    throw new Error("El identificador del correo local no es válido.");
  if (!PROVIDERS.includes(receipt.provider))
    throw new Error("Elige la app de la cajita para este correo.");
  if (!validAmount(receipt.amountCents))
    throw new Error("Revisa el monto del correo local.");
  if (!validMoment(receipt.at))
    throw new Error("La fecha del correo local no es válida o es futura.");
}

/** A local file can match any deposit already in a cajita, whoever added it. */
const matches = (data, receipt) =>
  findMatches(data, receipt, {
    canMatch: (entry) => entry.cents > 0,
    describe: (goal, entry) => ({
      source: entry.source ?? "manual",
      archived: Boolean(goal.archived),
    }),
  });

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
    return markSeen(data, receipt);
  }
  if (candidates.length && allowDuplicate !== true)
    throw new Error(
      "Elige el movimiento que corresponde al correo o confirma que es un depósito distinto.",
    );
  const goal = data.goals.find((item) => item.id === goalId);
  if (!goal || goal.archived || goal.provider !== receipt.provider)
    throw new Error("Elige una cajita activa de la misma app del correo.");
  return registerDeposit(data, receipt, goal.id, "manual");
}
