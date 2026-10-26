import { useCallback, useEffect, useRef, useState } from "react";
import { PARENT, addressFor, readLaunch } from "./launch.js";

/**
 * The screen the person is on. `go(tab)` changes it, keeps the address and
 * the scroll in step; `back` is where the back arrow leads; `launch` is what
 * the link that opened the app asked for. The phone's back button goes up
 * one level; at home the event is left alone so the app can close.
 */
export function useNavigation({ cloudConfigured, ownerTools }) {
  const [launch] = useState(() =>
    readLaunch(location.search, { cloudConfigured, ownerTools }),
  );
  const [tab, setTab] = useState(launch.tab);
  const current = useRef(tab);
  current.current = tab;
  const sync = useCallback(() => {
    const address = addressFor(location.href);
    if (address !== `${location.pathname}${location.search}${location.hash}`)
      history.replaceState({}, "", address);
  }, []);
  const go = useCallback(
    (key) => {
      setTab(key);
      sync();
      window.scrollTo({ top: 0, behavior: "instant" });
    },
    [sync],
  );
  useEffect(() => sync(), []);
  useEffect(() => {
    const back = (event) => {
      if (current.current === "goals") return;
      event.preventDefault();
      go(PARENT[current.current] ?? "goals");
    };
    window.addEventListener("guardadito:back", back);
    return () => window.removeEventListener("guardadito:back", back);
  }, [go]);
  return { tab, go, launch, back: PARENT[tab] ?? "goals" };
}
