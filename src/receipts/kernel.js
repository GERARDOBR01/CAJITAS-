// What every receipt import agrees on, however the receipt arrived: the same
// amount on the same day in the same app is the same deposit, a receipt is
// only counted once, and a deposit goes in through `recordEntry`.
import {
  PROVIDERS,
  localDate,
  recordEntry,
  validMovementDate,
  validateBackup,
} from "../domain.js";

export { PROVIDERS };
export const validAmount = (cents) =>
  Number.isSafeInteger(cents) && cents > 0 && cents <= 1e11;
export const validMoment = validMovementDate;

/**
 * Movements that could already be this receipt. `canMatch(entry)` says which
 * kinds of movement count; `describe(goal, entry)` adds what the caller needs
 * to show or filter on.
 */
export function findMatches(
  data,
  receipt,
  { canMatch, describe = () => ({}) },
) {
  if (data.importedIds.includes(receipt.id)) return [];
  const day = localDate(new Date(receipt.at));
  return data.goals
    .filter((goal) => goal.provider === receipt.provider)
    .flatMap((goal) =>
      goal.entries
        .filter(
          (entry) =>
            canMatch(entry) &&
            entry.cents === receipt.amountCents &&
            localDate(new Date(entry.at)) === day,
        )
        .map((entry) => ({
          goalId: goal.id,
          goalName: goal.name,
          entryId: entry.id,
          at: entry.at,
          ...describe(goal, entry),
        })),
    );
}

/** Count the receipt as seen without adding anything. */
export function markSeen(data, receipt) {
  const next = { ...data, importedIds: [...data.importedIds, receipt.id] };
  validateBackup(next);
  return next;
}

/** Add the receipt's deposit to a goal and count the receipt as seen. */
export function registerDeposit(data, receipt, goalId, source) {
  return recordEntry(
    { ...data, importedIds: [...data.importedIds, receipt.id] },
    goalId,
    { cents: receipt.amountCents, at: receipt.at, source },
  ).data;
}
