import { useEffect, useRef, useState } from "react";
import {
  dueSurprises,
  goalSummary,
  sameSpecial,
  specialFromGift,
  waitingRewards,
} from "./surprises.js";

const lib = () => import("./partner.js");
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
    [retry, setRetry] = useState(0);
  const shown = useRef(new Set()),
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
      .then(async ({ watchGifts, watchSummary }) => {
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
      ),
    remove: (id) => run((p) => p.deleteGift(pair.id, id)),
    unpair: () => run((p) => p.unpair(pair.id, uid), "Se deshizo el vínculo."),
  };
}
