import { useEffect, useRef, useState } from "react";
import { cloudConfigured } from "./config.js";
import { CLOUD_UID_KEY, firstSync, fromCloud, reconcile } from "./sync.js";

const SAVE_DELAY_MS = 600;
// How long signing out waits for the last change to reach the account.
const FLUSH_MS = 4000;
const RETRY_MS = 5000,
  MAX_RETRY_MS = 5 * 60 * 1000;
// A Firestore document holds 1 MiB; leave room for the other fields.
export const CLOUD_LIMIT_BYTES = 1000000;
export const cloudBytes = (data) =>
  new TextEncoder().encode(JSON.stringify(data)).length;
const lib = () => import("./firebase.js");

function readLinked() {
  try {
    return localStorage.getItem(CLOUD_UID_KEY);
  } catch {
    return null;
  }
}
function writeLinked(uid) {
  try {
    if (uid) localStorage.setItem(CLOUD_UID_KEY, uid);
    else localStorage.removeItem(CLOUD_UID_KEY);
  } catch {
    /* The link is a convenience; without it the next sign-in asks again. */
  }
}

/**
 * Keeps the journal of this device and the signed-in account together.
 * `latest` is a ref to the current journal; `applyRemote(data, message)`
 * replaces it with a copy that came from the account.
 */
export function useCloud({ latest, applyRemote, notify }) {
  const [user, setUser] = useState(null),
    [status, setStatus] = useState(cloudConfigured ? "loading" : "off"),
    [prompt, setPrompt] = useState(null);
  const linked = useRef(null),
    unwatch = useRef(null),
    timer = useRef(),
    retryTimer = useRef(),
    pending = useRef(null),
    attempts = useRef(0),
    warned = useRef(false),
    askingRef = useRef(false),
    callbacks = useRef();
  callbacks.current = { applyRemote, notify };
  askingRef.current = Boolean(prompt);

  function stop() {
    unwatch.current?.();
    unwatch.current = null;
    linked.current = null;
    clearTimeout(timer.current);
    clearTimeout(retryTimer.current);
    attempts.current = 0;
  }

  async function follow(uid) {
    const { watchState } = await lib();
    unwatch.current = await watchState(uid, (doc) => {
      try {
        const remote = fromCloud(doc);
        if (reconcile(latest.current, remote) === "pull")
          callbacks.current.applyRemote(
            remote,
            "Tus cajitas se actualizaron desde otro dispositivo.",
          );
      } catch {
        /* A damaged copy is ignored; the device keeps its own journal. */
      }
    });
  }

  async function act(uid, action, remote) {
    const { saveState } = await lib();
    if (action === "pull")
      callbacks.current.applyRemote(
        remote,
        "Tus cajitas llegaron de tu cuenta.",
      );
    linked.current = uid;
    attempts.current = 0;
    writeLinked(uid);
    if (action === "push")
      saveState(uid, latest.current).catch(() => setStatus("error"));
    await follow(uid);
    setStatus("synced");
  }

  async function start(account) {
    clearTimeout(retryTimer.current);
    setStatus("syncing");
    try {
      const { loadState } = await lib();
      const doc = await loadState(account.uid);
      const remote = doc ? fromCloud(doc) : null;
      const local = latest.current;
      const action = firstSync({
        local,
        remote,
        linkedUid: readLinked(),
        uid: account.uid,
      });
      if (action.startsWith("ask")) {
        setPrompt({ kind: action, uid: account.uid, local, remote });
        setStatus("waiting");
      } else await act(account.uid, action, remote);
    } catch {
      setStatus(navigator.onLine ? "error" : "offline");
      // Try again on its own: 5 s, 10 s, 20 s… up to 5 minutes. Coming back
      // online or to the app also tries at once (see the effect below).
      clearTimeout(retryTimer.current);
      const wait = Math.min(MAX_RETRY_MS, RETRY_MS * 2 ** attempts.current++);
      retryTimer.current = setTimeout(() => {
        if (!linked.current) start(account);
      }, wait);
    }
  }

  useEffect(() => {
    if (!cloudConfigured) return;
    let alive = true,
      unsubscribe,
      current = null;
    lib()
      .then(({ watchUser }) =>
        watchUser((account) => {
          if (!alive) return;
          stop();
          setPrompt(null);
          current = account;
          setUser(account);
          if (account) start(account);
          else setStatus("signed-out");
        }),
      )
      .then((fn) => (unsubscribe = fn))
      .catch(() => setStatus("error"));
    // Offline on the first try: the account's copy is read when back.
    const online = () => {
      if (current && !linked.current && alive && !askingRef.current)
        start(current);
    };
    const visible = () => {
      if (document.visibilityState === "visible") online();
    };
    window.addEventListener("online", online);
    document.addEventListener("visibilitychange", visible);
    return () => {
      alive = false;
      unsubscribe?.();
      window.removeEventListener("online", online);
      document.removeEventListener("visibilitychange", visible);
      clearTimeout(retryTimer.current);
      stop();
    };
  }, []);

  /** Called after every saved change on this device. */
  function save(data) {
    const uid = linked.current;
    if (!uid) return;
    const bytes = cloudBytes(data);
    if (bytes > CLOUD_LIMIT_BYTES) {
      setStatus("full");
      return;
    }
    if (bytes > CLOUD_LIMIT_BYTES * 0.7 && !warned.current) {
      warned.current = true;
      callbacks.current.notify?.(
        "Tu historial ya ocupa mucho en tu cuenta. Descarga un respaldo y escríbenos desde Ayuda para hacerle espacio.",
      );
    }
    clearTimeout(timer.current);
    // Until the account confirms it, this copy is still on its way up.
    pending.current = data;
    timer.current = setTimeout(async () => {
      setStatus(navigator.onLine ? "syncing" : "offline");
      try {
        const { saveState } = await lib();
        await saveState(uid, data);
        if (pending.current === data) pending.current = null;
        if (linked.current === uid) setStatus("synced");
      } catch {
        setStatus("error");
      }
    }, SAVE_DELAY_MS);
  }

  async function resolve(choice) {
    const p = prompt;
    if (!p) return;
    setPrompt(null);
    if (choice === "cancel") {
      const { signOutUser } = await lib();
      await signOutUser();
      return;
    }
    if (choice === "account") return act(p.uid, "pull", p.remote);
    // This device wins: make it newer than the account so every device
    // follows it.
    if (p.remote)
      callbacks.current.applyRemote({
        ...latest.current,
        savedAt:
          Math.max(latest.current.savedAt ?? 0, p.remote.savedAt ?? 0) + 1,
      });
    return act(p.uid, "push");
  }

  /** Closes the session and erases the account's offline copy from this
   * phone; the caller reloads the app afterwards. */
  async function signOut() {
    // A change saved a moment ago may still be waiting to go up: send it now,
    // before the session and the offline queue are gone.
    const uid = linked.current,
      waiting = pending.current;
    if (uid && waiting) {
      const { saveState } = await lib();
      const arrived = await Promise.race([
        saveState(uid, waiting).then(() => true),
        new Promise((resolve) => setTimeout(() => resolve(false), FLUSH_MS)),
      ]).catch(() => false);
      if (arrived && pending.current === waiting) pending.current = null;
    }
    // Whether something never made it up (offline): then this phone keeps
    // the only copy of it.
    const lost = Boolean(pending.current);
    pending.current = null;
    stop();
    writeLinked(null);
    const { signOutUser } = await lib();
    await signOutUser({ clearCache: true });
    return { unsaved: lost };
  }

  async function removeAccount(password) {
    const { deleteAccount } = await lib();
    await deleteAccount(password);
    stop();
    writeLinked(null);
  }

  return {
    configured: cloudConfigured,
    user,
    status,
    /** A change on this phone has not reached the account yet. */
    unsaved: () => Boolean(pending.current),
    prompt,
    save,
    resolve,
    signOut,
    removeAccount,
  };
}
