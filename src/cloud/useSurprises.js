import { useEffect, useRef, useState } from "react";
import {
  dueSurprises,
  sameSpecial,
  specialFromGift,
  waitingRewards,
} from "./surprises.js";
import { useSubscription } from "./useSubscription.js";

const lib = () => import("./partner.js");

/**
 * The surprises between the couple: notes, rewards and a pet as a gift,
 * each opened when its moment comes. `couple` is what `usePartner` knows
 * about the pair; `run` and `tell` write and let the partner's phone know.
 */
export function useSurprises({ couple, data, callbacks, run, tell }) {
  const { pair, uid, partnerUid } = couple;
  const [gifts, setGifts] = useState([]),
    [reveal, setReveal] = useState(null),
    [saved, setSaved] = useState(0);
  const shown = useRef(new Set());

  useSubscription(
    Boolean(pair && partnerUid),
    (p, live, again) => p.watchGifts(pair.id, live(setGifts), again),
    () => setGifts([]),
    [pair?.id, partnerUid],
  );

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

  return {
    sent: gifts.filter((g) => g.from === uid),
    received: gifts.filter((g) => g.to === uid),
    waiting: pair ? waitingRewards({ gifts, uid, data }) : [],
    reveal,
    closeReveal: close,
    /** Notes that wait for the next saving show up now. */
    onSaved: () => setSaved((n) => n + 1),
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
  };
}
