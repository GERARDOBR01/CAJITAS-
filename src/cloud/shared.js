import { money, plan } from "../domain.js";

/** Cajitas en pareja with their entries, oldest entry first. */
export function withEntries(goals, entries) {
  return goals
    .map((goal) => ({
      ...goal,
      entries: entries
        .filter((e) => e.goalId === goal.id)
        .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0)),
    }))
    .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
}

/** What each person has set aside so far. */
export function contributions(goal) {
  const by = {};
  for (const e of goal.entries) by[e.by] = (by[e.by] ?? 0) + e.cents;
  return by;
}

/** My part of the target, what I already put in and what is left. */
export function myPart(goal, uid) {
  const percent = goal.split?.[uid] ?? 50;
  const share = Math.round((goal.targetCents * percent) / 100);
  const mine = contributions(goal)[uid] ?? 0;
  return { percent, share, mine, remaining: Math.max(0, share - mine) };
}

/** Suggested amount per period for my part, like a personal cajita. */
export function myPlan(goal, uid, frequency, now, weekday) {
  const { share, mine } = myPart(goal, uid);
  return plan(
    {
      targetCents: share,
      unlockDate: goal.unlockDate,
      entries: [{ cents: mine }],
    },
    frequency,
    now,
    weekday,
  );
}

/** A withdrawal can only take out what that person put in. */
export function checkEntry(goal, uid, cents) {
  if (!Number.isSafeInteger(cents) || cents === 0)
    throw new Error("Revisa el monto.");
  if (cents < 0 && -cents > (contributions(goal)[uid] ?? 0))
    throw new Error("Solo puedes retirar lo que tú apartaste en esta cajita.");
  return cents;
}

/** Split from the form: my percentage, the rest for my partner. */
export function splitFor(uid, partnerUid, myPercent) {
  const mine = Math.min(100, Math.max(0, Math.round(Number(myPercent))));
  return { [uid]: mine, [partnerUid]: 100 - mine };
}

/**
 * A cheer for each saving my partner recorded in a cajita we share since
 * `seen` (the entry ids already there).
 */
export function sharedEntryNews(seen, entries, goals, partnerUid, who) {
  return entries
    .filter((e) => !seen.has(e.id) && e.by === partnerUid && e.cents > 0)
    .map(
      (e) =>
        `${who} apartó ${money(e.cents)} para ${goals.find((g) => g.id === e.goalId)?.name ?? "su cajita"} 🎉`,
    );
}
