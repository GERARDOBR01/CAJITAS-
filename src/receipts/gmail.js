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
  if (!receipt || typeof receipt.id !== "string" || !receipt.id.trim())
    throw new Error("Identificador de correo inválido.");
  if (!validAmount(receipt.amountCents))
    throw new Error("Monto de correo inválido.");
  if (!validMoment(receipt.at))
    throw new Error("Fecha de correo inválida o futura.");
  if (
    (receipt.provider !== undefined && !PROVIDERS.includes(receipt.provider)) ||
    (receipt.validated !== undefined && typeof receipt.validated !== "boolean")
  )
    throw new Error("El comprobante de correo no es válido.");
}

/** Gmail only recognises movements the person typed in. */
export function possibleReceiptMatches(data, receipt) {
  validateReceipt(receipt);
  if (!receipt.provider) return [];
  return findMatches(data, receipt, {
    canMatch: (entry) =>
      entry.source === undefined || entry.source === "manual",
  });
}

/** Linking turns the person's movement into the Gmail one. */
export function reconcileReceipt(data, receipt, goalId, entryId) {
  validateReceipt(receipt);
  if (data.importedIds.includes(receipt.id)) return data;
  if (
    !possibleReceiptMatches(data, receipt).some(
      (match) => match.goalId === goalId && match.entryId === entryId,
    )
  )
    throw new Error("Elige un movimiento manual del mismo monto, app y día.");
  const seen = markSeen(data, receipt);
  const next = {
    ...seen,
    goals: seen.goals.map((goal) =>
      goal.id === goalId
        ? {
            ...goal,
            entries: goal.entries.map((entry) =>
              entry.id === entryId ? { ...entry, source: "gmail" } : entry,
            ),
          }
        : goal,
    ),
  };
  validateBackup(next);
  return next;
}

export function addReceipt(
  data,
  receipt,
  goalId,
  { allowPossibleDuplicate = false } = {},
) {
  if (
    data.importedIds.includes(receipt.id) ||
    !data.goals.some((g) => g.id === goalId)
  )
    return data;
  validateReceipt(receipt);
  const goal = data.goals.find((item) => item.id === goalId);
  if (goal.archived || (receipt.provider && goal.provider !== receipt.provider))
    throw new Error("Elige una cajita activa de la misma app del comprobante.");
  if (!allowPossibleDuplicate && possibleReceiptMatches(data, receipt).length)
    throw new Error(
      "Revisa los movimientos manuales que podrían corresponder a este correo.",
    );
  return registerDeposit(data, receipt, goalId, "gmail");
}
