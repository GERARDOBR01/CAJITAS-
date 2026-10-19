import { useEffect, useState } from "react";

const lib = () => import("./partner.js");
const RETRY_MS = 2000;

/**
 * Keeps one Firestore listener of the couple open while `active`.
 * `subscribe(partner, live, again)` starts it and resolves to its stop
 * function; `live(fn)` drops calls after it closed and `again` is the error
 * handler: a listener can be refused for a moment (e.g. right after pairing),
 * so it tries again shortly, alone, instead of staying deaf. `reset` clears
 * what the previous listener left.
 */
export function useSubscription(active, subscribe, reset, deps) {
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    reset();
    if (!active) return;
    let stop,
      alive = true,
      timer;
    const live =
      (fn) =>
      (...args) =>
        alive && fn(...args);
    const again = () => {
      clearTimeout(timer);
      if (alive) timer = setTimeout(() => setRetry((n) => n + 1), RETRY_MS);
    };
    lib()
      .then((partner) => subscribe(partner, live, again))
      .then((fn) => (alive ? (stop = fn) : fn()))
      .catch(() => {});
    return () => {
      alive = false;
      clearTimeout(timer);
      stop?.();
    };
  }, [...deps, active, retry]);
}
