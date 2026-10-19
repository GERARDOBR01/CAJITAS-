import { reachedTarget } from "../domain.js";
import { WITHDRAWAL_NOTE } from "../pet/state.js";

export const GOAL_REACHED = "¡Meta alcanzada! Poquito a poquito, lo lograste ✦";
const SAVED = "Ahorro registrado. ¡Un pasito más!";

/**
 * The respuesta al ahorro: what the person hears after a change to the
 * journal, read from the change itself. `detail` is the caller's own sentence
 * (a Gmail summary, a guardian's confirmation) and leads the message.
 *
 * - `kind`: "celebrate" when a cajita reached its target, "cheer" when money
 *   came in, "withdrawal" when it went out, otherwise "plain".
 * - `saved`: money came into a cajita, so it counts as saving (surprises for
 *   the next saving open, the reminder is answered).
 */
export function savingResponse(before, after, detail = "") {
  const known = new Set(
    before.goals.flatMap((goal) => goal.entries.map((entry) => entry.id)),
  );
  const added = after.goals.flatMap((goal) =>
    goal.entries.filter((entry) => !known.has(entry.id)),
  );
  const saved = added.some((entry) => entry.cents > 0);
  if (after.goals.some((goal) => reachedTarget(before, after, goal.id)))
    return {
      kind: "celebrate",
      saved,
      message: detail ? `${detail} ${GOAL_REACHED}` : GOAL_REACHED,
    };
  if (saved) return { kind: "cheer", saved, message: detail || SAVED };
  if (added.some((entry) => entry.cents < 0))
    return { kind: "withdrawal", saved, message: detail || WITHDRAWAL_NOTE };
  return { kind: "plain", saved, message: detail };
}
