import { useEffect, useRef, useState } from "react";
import { money } from "../domain.js";
import {
  applyConfirmed,
  checkDeposit,
  confirmationNote,
  depositNews,
  depositStatuses,
  guardianView,
} from "./deposits.js";
import { useSubscription } from "./useSubscription.js";

const lib = () => import("./partner.js");

/**
 * Money through the guardian: the CLABEs, the deposits on their way and the
 * ones my guardian confirmed, which become movements in my cajitas.
 * `couple` is what `usePartner` knows about the pair; `run` and `tell` write
 * and let the partner's phone know.
 */
export function useGuardian({ couple, data, callbacks, run, tell }) {
  const { pair, uid, partnerUid, partnerName } = couple;
  const [payouts, setPayouts] = useState({}),
    [deposits, setDeposits] = useState(null);
  const seen = useRef(null),
    applying = useRef(new Set());

  useSubscription(
    Boolean(pair && partnerUid),
    (p, live, again) =>
      p.watchMoney(pair.id, live(setPayouts), live(setDeposits), again),
    () => {
      setPayouts({});
      setDeposits(null);
      seen.current = null;
    },
    [pair?.id, partnerUid],
  );

  // Money news: my partner says they sent me something, or my guardian
  // answered. The first list (null until it loads) is what was there.
  useEffect(() => {
    if (!deposits) return;
    const before = seen.current;
    seen.current = depositStatuses(deposits);
    if (!before) return;
    for (const news of depositNews(
      before,
      deposits,
      uid,
      partnerName || "Tu pareja",
    ))
      callbacks.current.notify(news);
  }, [deposits]);

  // A deposit my guardian confirmed becomes a movement in my cajita.
  useEffect(() => {
    if (!deposits || !pair || !uid) return;
    const fresh = deposits.filter((d) => !applying.current.has(d.id));
    const { marks, added } = applyConfirmed(data, fresh, uid);
    if (!marks.length) return;
    if (
      added.length &&
      !callbacks.current.record(
        (current) => applyConfirmed(current, added, uid).data,
        confirmationNote(added, partnerName || "Tu guardián"),
      )
    )
      return;
    marks.forEach((d) => applying.current.add(d.id));
    lib()
      .then(({ markApplied }) =>
        Promise.all(marks.map((d) => markApplied(pair.id, d.id))),
      )
      // The movement is already in my journal; marking it is retried later.
      .catch(() => marks.forEach((d) => applying.current.delete(d.id)));
  }, [deposits, data.savedAt, pair?.id, uid]);

  return {
    /** The partner keeps my money when they saved a CLABE. */
    guardian: (partnerUid && payouts[partnerUid]) || null,
    myPayout: (uid && payouts[uid]) || null,
    ...guardianView(deposits ?? [], uid),
    savePayout: (payout) =>
      run(
        (p) => p.savePayout(pair.id, uid, payout),
        `Listo: ${partnerName || "tu pareja"} ya puede mandarte su ahorro.`,
      ),
    deletePayout: () =>
      run((p) => p.deletePayout(pair.id, uid), "Quitaste tu CLABE."),
    deposit: (goal, cents, method, pendingOut = 0) =>
      run(
        (p) =>
          p.requestDeposit(pair.id, {
            from: uid,
            to: partnerUid,
            goalId: goal.id,
            goalName: goal.name.slice(0, 80),
            cents: checkDeposit(goal, cents, pendingOut),
            method,
          }),
        cents > 0
          ? `Avisamos a ${partnerName || "tu pareja"}. Cuenta en tu cajita cuando confirme que llegó.`
          : `Le pedimos ${money(-cents)} a ${partnerName || "tu pareja"}.`,
      ).then(tell("deposit")),
    decide: (deposit, confirmed) =>
      run(
        (p) => p.decideDeposit(pair.id, deposit.id, confirmed),
        confirmed
          ? deposit.cents > 0
            ? "Confirmado. Ya cuenta en su cajita 💞"
            : "Retiro confirmado."
          : "Le avisamos que todavía no.",
      ).then(() => tell("deposit")(deposit.id)),
    cancelDeposit: (id) =>
      run((p) => p.deleteDeposit(pair.id, id), "Aviso cancelado."),
  };
}
