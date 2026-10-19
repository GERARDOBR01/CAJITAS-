import { useCallback, useEffect, useRef, useState } from "react";
import { addressFor, readLaunch } from "./launch.js";

/**
 * The screen the person is on. `go(tab)` changes it, keeps the address and
 * the scroll in step; `launch` is what the link that opened the app asked for.
 * The native back button, when there is nothing to go back to, means "home";
 * already there, the event is left alone so the app can close.
 */
export function useNavigation({ cloudConfigured }) {
  const [launch] = useState(() =>
    readLaunch(location.search, { cloudConfigured }),
  );
  const [tab, setTab] = useState(launch.tab);
  const current = useRef(tab);
  current.current = tab;
  const sync = useCallback((key) => {
    const address = addressFor(location.href, key);
    if (address !== `${location.pathname}${location.search}${location.hash}`)
      history.replaceState({}, "", address);
  }, []);
  const go = useCallback(
    (key) => {
      setTab(key);
      sync(key);
      window.scrollTo({ top: 0, behavior: "instant" });
    },
    [sync],
  );
  useEffect(() => sync(launch.tab), []);
  useEffect(() => {
    const back = (event) => {
      if (current.current === "goals") return;
      event.preventDefault();
      go("goals");
    };
    window.addEventListener("guardadito:back", back);
    return () => window.removeEventListener("guardadito:back", back);
  }, [go]);
  return { tab, go, launch };
}
