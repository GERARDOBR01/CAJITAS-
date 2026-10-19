import { useEffect, useRef, useState } from "react";
import {
  checkEntry,
  sharedEntryNews,
  splitFor,
  withEntries,
} from "./shared.js";
import { useSubscription } from "./useSubscription.js";

/**
 * Cajitas en pareja: the goals both put money into and what each one set
 * aside. `couple` is what `usePartner` knows about the pair; `run` and `tell`
 * write and let the partner's phone know.
 */
export function useSharedGoals({ couple, callbacks, run, tell }) {
  const { pair, uid, partnerUid, partnerName } = couple;
  const [goals, setGoals] = useState([]),
    [entries, setEntries] = useState(null);
  const seen = useRef(null);

  useSubscription(
    Boolean(pair && partnerUid),
    (p, live, again) =>
      p.watchShared(pair.id, live(setGoals), live(setEntries), again),
    () => {
      setGoals([]);
      setEntries(null);
      seen.current = null;
    },
    [pair?.id, partnerUid],
  );

  // A cheer when my partner records a saving in a cajita we share. The
  // first list (null until it loads) is what was already there.
  useEffect(() => {
    if (!entries) return;
    const before = seen.current;
    seen.current = new Set(entries.map((e) => e.id));
    if (!before) return;
    for (const news of sharedEntryNews(
      before,
      entries,
      goals,
      partnerUid,
      partnerName || "Tu pareja",
    ))
      callbacks.current.notify(news);
  }, [entries]);

  return {
    shared: withEntries(goals, entries ?? []),
    saveShared: (
      { id, name, targetCents, unlockDate, myPercent, archived },
      existing,
    ) =>
      run(
        (p) =>
          p.saveSharedGoal(
            pair.id,
            {
              name,
              targetCents,
              unlockDate: unlockDate || "",
              icon: existing?.icon ?? "star",
              split: splitFor(uid, partnerUid, myPercent),
              createdBy: existing?.createdBy ?? uid,
              createdAt: existing?.createdAt ?? Date.now(),
              archived: Boolean(archived),
            },
            id,
          ),
        existing ? "Cajita actualizada." : `Cajita en pareja lista 💞`,
      ),
    contribute: (goal, cents, at, note = "") =>
      run(
        (p) =>
          p.addSharedEntry(pair.id, {
            goalId: goal.id,
            by: uid,
            cents: checkEntry(goal, uid, cents),
            at,
            note,
          }),
        cents > 0
          ? "Aporte registrado. ¡Un pasito juntos! 💞"
          : "Retiro registrado. Usarlo también es cumplir su propósito.",
      ).then(tell("entry")),
    removeEntry: (id) =>
      run((p) => p.deleteSharedEntry(pair.id, id), "Aporte borrado."),
  };
}
