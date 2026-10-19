import { useEffect, useRef, useState } from "react";
import {
  dueSurprises,
  goalSummary,
  sameSpecial,
  specialFromGift,
  waitingRewards,
} from "./surprises.js";
import { checkEntry, splitFor, withEntries } from "./shared.js";
import { applyConfirmed, checkDeposit, pendingByGoal } from "./deposits.js";
import { money } from "../domain.js";
import { pushConfigured } from "./config.js";

const lib = () => import("./partner.js");
const pushLib = () => import("./push.js");
const INVITE_KEY = "guardadito:invite";
function stored() {
  try {
    return localStorage.getItem(INVITE_KEY) || "";
  } catch {
    return "";
  }
}
function store(code) {
  try {
    if (code) localStorage.setItem(INVITE_KEY, code);
    else localStorage.removeItem(INVITE_KEY);
  } catch {
    /* Only a convenience to show the code again. */
  }
}
const SUMMARY_DELAY_MS = 1500;

/**
 * The couple of the signed-in account: who the partner is, the surprises
 * between them and how the partner's cajitas are going. `update(fn)` saves
 * a change computed from the latest journal.
 */
export function usePartner({ user, data, update, notify }) {
  const [pair, setPair] = useState(null),
    [gifts, setGifts] = useState([]),
    [summary, setSummary] = useState([]),
    [reveal, setReveal] = useState(null),
    [saved, setSaved] = useState(0),
    [invite, setInvite] = useState(stored),
    [retry, setRetry] = useState(0),
    [sharedGoals, setSharedGoals] = useState([]),
    [sharedEntries, setSharedEntries] = useState(null),
    [payouts, setPayouts] = useState({}),
    [deposits, setDeposits] = useState(null);
  const shown = useRef(new Set()),
    seenEntries = useRef(null),
    seenDeposits = useRef(null),
    applying = useRef(new Set()),
    callbacks = useRef();
  callbacks.current = { update, notify };
  const uid = user?.uid ?? null;
  const partnerUid = pair?.members.find((m) => m !== uid) ?? null;
  const partnerName = (partnerUid && pair?.names?.[partnerUid]) || "";

  useEffect(() => {
    setPair(null);
    if (!uid) return;
    let stop,
      alive = true;
    lib()
      .then(({ watchPair }) => watchPair(uid, (p) => alive && setPair(p)))
      .then((fn) => (alive ? (stop = fn) : fn()))
      .catch(() => {});
    return () => {
      alive = false;
      stop?.();
    };
  }, [uid]);

  useEffect(() => {
    setGifts([]);
    setSummary([]);
    setSharedGoals([]);
    setSharedEntries(null);
    setPayouts({});
    setDeposits(null);
    seenEntries.current = null;
    seenDeposits.current = null;
    if (!pair || !partnerUid) return;
    const stops = [];
    let alive = true,
      timer;
    // A listener can be refused for a moment (e.g. right after pairing);
    // try again shortly instead of staying deaf.
    const again = () => {
      clearTimeout(timer);
      if (alive) timer = setTimeout(() => setRetry((n) => n + 1), 2000);
    };
    lib()
      .then(async ({ watchGifts, watchSummary, watchShared, watchMoney }) => {
        const d = await watchMoney(
          pair.id,
          (p) => alive && setPayouts(p),
          (list) => alive && setDeposits(list),
          again,
        );
        stops.push(d);
        const c = await watchShared(
          pair.id,
          (g) => alive && setSharedGoals(g),
          (e) => alive && setSharedEntries(e),
          again,
        );
        stops.push(c);
        const a = await watchGifts(pair.id, (g) => alive && setGifts(g), again);
        const b = await watchSummary(
          pair.id,
          partnerUid,
          (s) => alive && setSummary(s),
          again,
        );
        stops.push(a, b);
        if (!alive) stops.forEach((fn) => fn());
      })
      .catch(() => {});
    return () => {
      alive = false;
      clearTimeout(timer);
      stops.forEach((fn) => fn());
    };
  }, [pair?.id, partnerUid, retry]);

  // A cheer when my partner records a saving in a cajita we share. The
  // first list (null until it loads) is what was already there.
  useEffect(() => {
    if (!sharedEntries) return;
    const ids = new Set(sharedEntries.map((e) => e.id));
    if (seenEntries.current === null) {
      seenEntries.current = ids;
      return;
    }
    for (const e of sharedEntries)
      if (
        !seenEntries.current.has(e.id) &&
        e.by === partnerUid &&
        e.cents > 0
      ) {
        const goal = sharedGoals.find((g) => g.id === e.goalId);
        callbacks.current.notify(
          `${partnerName || "Tu pareja"} apartó ${money(e.cents)} para ${goal?.name ?? "su cajita"} 🎉`,
        );
      }
    seenEntries.current = ids;
  }, [sharedEntries]);

  // Money news: my partner says they sent me something, or my guardian
  // answered. The first list (null until it loads) is what was there.
  useEffect(() => {
    if (!deposits) return;
    const before = seenDeposits.current;
    seenDeposits.current = new Map(deposits.map((d) => [d.id, d.status]));
    if (!before) return;
    const who = partnerName || "Tu pareja";
    for (const d of deposits) {
      if (before.get(d.id) === d.status) continue;
      const amount = money(Math.abs(d.cents));
      if (d.to === uid && d.status === "pending")
        callbacks.current.notify(
          d.cents > 0
            ? `${who} dice que te mandó ${amount} para ${d.goalName}. ¿Te llegó?`
            : `${who} te pide ${amount} de ${d.goalName}.`,
        );
      else if (d.from === uid && d.status === "rejected")
        callbacks.current.notify(
          d.cents > 0
            ? `${who} todavía no ve tus ${amount}. Revisa la transferencia.`
            : `${who} no pudo darte ${amount} por ahora.`,
        );
    }
  }, [deposits]);

  // A deposit my guardian confirmed becomes a movement in my cajita.
  useEffect(() => {
    if (!deposits || !pair || !uid) return;
    const fresh = deposits.filter((d) => !applying.current.has(d.id));
    const { marks, added } = applyConfirmed(data, fresh, uid);
    if (!marks.length) return;
    if (
      added.length &&
      callbacks.current.update(
        (current) => applyConfirmed(current, added, uid).data,
      ) === false
    )
      return;
    marks.forEach((d) => applying.current.add(d.id));
    if (added.length) {
      const total = added.reduce((sum, d) => sum + d.cents, 0);
      const who = partnerName || "Tu guardián";
      callbacks.current.notify(
        total > 0
          ? `${who} confirmó tu depósito: +${money(total)} 💞`
          : `${who} confirmó tu retiro de ${money(-total)}.`,
      );
      if (total > 0) setSaved((n) => n + 1);
    }
    lib()
      .then(({ markApplied }) =>
        Promise.all(marks.map((d) => markApplied(pair.id, d.id))),
      )
      // The movement is already in my journal; marking it is retried later.
      .catch(() => marks.forEach((d) => applying.current.delete(d.id)));
  }, [deposits, data.savedAt, pair?.id, uid]);

  // A phone that already allowed notices stays registered with the couple.
  useEffect(() => {
    if (!pair || !uid || !pushConfigured) return;
    pushLib()
      .then(({ refreshPush }) => refreshPush(pair.id, uid))
      .catch(() => {});
  }, [pair?.id, uid]);

  // Once paired, the code I shared is no longer needed.
  useEffect(() => {
    if (!pair || !invite) return;
    lib()
      .then(({ cancelInvite }) => cancelInvite(invite))
      .catch(() => {});
    store("");
    setInvite("");
  }, [pair?.id, invite]);

  // My partner sees names and progress of my cajitas.
  useEffect(() => {
    if (!pair || !uid) return;
    const timer = setTimeout(() => {
      lib()
        .then(({ publishSummary }) =>
          publishSummary(pair.id, uid, goalSummary(data)),
        )
        .catch(() => {});
    }, SUMMARY_DELAY_MS);
    return () => clearTimeout(timer);
  }, [pair?.id, uid, data.savedAt]);

  // A special pet keeps its words in my journal, so it works offline too.
  useEffect(() => {
    const gift = gifts.find(
      (g) => g.kind === "pet" && g.to === uid && g.from === partnerUid,
    );
    if (
      !gift ||
      sameSpecial(gift && specialFromGift(gift), data.preferences.special)
    )
      return;
    callbacks.current.update((current) => ({
      ...current,
      preferences: {
        ...current.preferences,
        special: specialFromGift(gift, current.preferences.special),
      },
    }));
  }, [gifts, uid, partnerUid, data.preferences.special]);

  // One surprise at a time.
  useEffect(() => {
    if (reveal || !pair) return;
    const next = dueSurprises({ gifts, uid, data, saved }).find(
      (g) => !shown.current.has(g.id),
    );
    if (next) setReveal(next);
  }, [gifts, data.savedAt, saved, reveal, pair?.id]);

  async function close() {
    const gift = reveal;
    setReveal(null);
    if (!gift) return;
    shown.current.add(gift.id);
    try {
      const { markOpened } = await lib();
      await markOpened(pair.id, gift.id);
    } catch {
      /* Shown here already; it is marked next time. */
    }
  }

  // After a write the partner should hear about, tell their phones too.
  function tell(kind) {
    return (id) => {
      const pairId = pair?.id;
      if (pairId && id)
        pushLib()
          .then(({ notifyPartner }) => notifyPartner(pairId, kind, id))
          .catch(() => {});
      return id;
    };
  }

  async function run(fn, success) {
    try {
      const value = await fn(await lib());
      if (success) callbacks.current.notify(success);
      return value;
    } catch (error) {
      callbacks.current.notify(
        error.message || "No se pudo. Intenta de nuevo.",
      );
      throw error;
    }
  }

  return {
    pair,
    partnerUid,
    partnerName,
    summary,
    sent: gifts.filter((g) => g.from === uid),
    received: gifts.filter((g) => g.to === uid),
    waiting: pair ? waitingRewards({ gifts, uid, data }) : [],
    reveal,
    closeReveal: close,
    /** Notes that wait for the next saving show up now. */
    onSaved: () => setSaved((n) => n + 1),
    invite,
    createInvite: () =>
      run((p) => p.createInvite(user)).then((code) => {
        store(code);
        setInvite(code);
      }),
    cancelInvite: () =>
      run((p) => p.cancelInvite(invite)).then(() => {
        store("");
        setInvite("");
      }),
    accept: (code) =>
      run((p) => p.acceptInvite(user, code)).then((name) =>
        callbacks.current.notify(`¡Listo! Ahora tú y ${name} están juntos 💞`),
      ),
    send: (gift, id, message) =>
      run(
        (p) =>
          p.sendGift(
            pair.id,
            {
              ...gift,
              from: uid,
              to: partnerUid,
              fromName: pair.names?.[uid] || "",
            },
            id,
          ),
        message,
      ).then(tell("gift")),
    remove: (id) => run((p) => p.deleteGift(pair.id, id)),
    shared: withEntries(sharedGoals, sharedEntries ?? []),
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
    unpair: () => run((p) => p.unpair(pair.id, uid), "Se deshizo el vínculo."),
    /** The partner keeps my money when they saved a CLABE. */
    guardian: (partnerUid && payouts[partnerUid]) || null,
    myPayout: (uid && payouts[uid]) || null,
    myName: (uid && pair?.names?.[uid]) || "",
    pending: pendingByGoal(deposits ?? [], uid),
    /** What I keep for my partner: everything I confirmed, in and out. */
    held: (deposits ?? [])
      .filter((d) => d.to === uid && d.status === "confirmed")
      .reduce((sum, d) => sum + d.cents, 0),
    toConfirm: (deposits ?? [])
      .filter((d) => d.to === uid && d.status === "pending")
      .sort((a, b) => a.createdAt - b.createdAt),
    myDeposits: (deposits ?? [])
      .filter((d) => d.from === uid && d.status !== "confirmed")
      .sort((a, b) => b.createdAt - a.createdAt),
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
