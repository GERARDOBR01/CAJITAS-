import { useEffect, useRef, useState } from "react";
import { goalSummary } from "./surprises.js";
import { pushConfigured } from "./config.js";
import { useGuardian } from "./useGuardian.js";
import { useSharedGoals } from "./useSharedGoals.js";
import { useSurprises } from "./useSurprises.js";
import { useSubscription } from "./useSubscription.js";

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
 * The couple of the signed-in account: who the partner is and how the
 * partner's cajitas are going, plus the surprises (`useSurprises`), the
 * cajitas en pareja (`useSharedGoals`) and the money through the guardian
 * (`useGuardian`), each with its own listener. `update(fn)` saves a change
 * computed from the latest journal; `record(fn, detail)` does the same for a
 * movement and answers it like any other saving.
 */
export function usePartner({ user, data, update, record, notify }) {
  const [pair, setPair] = useState(null),
    [summary, setSummary] = useState([]),
    [invite, setInvite] = useState(stored);
  const callbacks = useRef();
  callbacks.current = { update, record, notify };
  const uid = user?.uid ?? null;
  const partnerUid = pair?.members.find((m) => m !== uid) ?? null;
  const partnerName = (partnerUid && pair?.names?.[partnerUid]) || "";
  const couple = { pair, uid, partnerUid, partnerName };

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

  // How my partner's cajitas are going.
  useSubscription(
    Boolean(pair && partnerUid),
    (p, live, again) =>
      p.watchSummary(pair.id, partnerUid, live(setSummary), again),
    () => setSummary([]),
    [pair?.id, partnerUid],
  );

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

  const parts = { couple, data, callbacks, run, tell };
  const surprises = useSurprises(parts),
    shared = useSharedGoals(parts),
    guardian = useGuardian(parts);
  return {
    pair,
    partnerUid,
    partnerName,
    summary,
    ...surprises,
    ...shared,
    ...guardian,
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
    unpair: () => run((p) => p.unpair(pair.id, uid), "Se deshizo el vínculo."),
    myName: (uid && pair?.names?.[uid]) || "",
  };
}
