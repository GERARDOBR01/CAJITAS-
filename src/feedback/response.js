import { balance, moneyShort, reachedTarget } from "../domain.js";
import { WITHDRAWAL_NOTE } from "../pet/state.js";

export const GOAL_REACHED = "¡Meta alcanzada! Poquito a poquito, lo lograste ✦";
const SAVED = "Ahorro registrado. ¡Un pasito más!";
export const FIRST_SAVING = "¡Tu primer pasito! Así empiezan los sueños ✦";
/** Under this, a saving gets a word for being small and still counting. */
const SMALL_CENTS = 10000;
const MILESTONES = [
  [0.75, (name) => `¡Tres cuartas partes de ${name}! Ya casi ✦`],
  [0.5, (name) => `¡Ya vas a la mitad de ${name}!`],
  [0.25, (name) => `Ya llevas una cuarta parte de ${name} 🌱`],
];

/** The kindest true thing to say about money that just came in. */
function cheer(before, after, added) {
  const savedBefore = before.goals.some((g) =>
    g.entries.some((e) => e.cents > 0),
  );
  if (!savedBefore) return FIRST_SAVING;
  for (const goal of after.goals) {
    const was = before.goals.find((g) => g.id === goal.id);
    if (!was || !goal.targetCents) continue;
    const from = balance(was) / goal.targetCents,
      to = balance(goal) / goal.targetCents;
    const crossed = MILESTONES.find(([mark]) => from < mark && to >= mark);
    if (crossed) return crossed[1](goal.name);
  }
  const cents = added
    .filter((e) => e.cents > 0)
    .reduce((s, e) => s + e.cents, 0);
  if (cents < SMALL_CENTS)
    return `${moneyShort(cents)} también cuentan. ¡Así se hace!`;
  return SAVED;
}

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
  if (saved)
    return {
      kind: "cheer",
      saved,
      message: detail || cheer(before, after, added),
    };
  if (added.some((entry) => entry.cents < 0))
    return { kind: "withdrawal", saved, message: detail || WITHDRAWAL_NOTE };
  return { kind: "plain", saved, message: detail };
}
