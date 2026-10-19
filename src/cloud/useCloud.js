import { useEffect, useRef, useState } from "react";
import { cloudConfigured } from "./config.js";
import { CLOUD_UID_KEY, firstSync, fromCloud, reconcile } from "./sync.js";

const SAVE_DELAY_MS = 600;
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
    callbacks = useRef();
  callbacks.current = { applyRemote, notify };

  function stop() {
    unwatch.current?.();
    unwatch.current = null;
    linked.current = null;
    clearTimeout(timer.current);
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
    writeLinked(uid);
    if (action === "push")
      saveState(uid, latest.current).catch(() => setStatus("error"));
    await follow(uid);
    setStatus("synced");
  }

  async function start(account) {
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
      if (current && !linked.current && alive) start(current);
    };
    window.addEventListener("online", online);
    return () => {
      alive = false;
      unsubscribe?.();
      window.removeEventListener("online", online);
      stop();
    };
  }, []);

  /** Called after every saved change on this device. */
  function save(data) {
    const uid = linked.current;
    if (!uid) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setStatus(navigator.onLine ? "syncing" : "offline");
      try {
        const { saveState } = await lib();
        await saveState(uid, data);
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

  async function signOut() {
    stop();
    writeLinked(null);
    const { signOutUser } = await lib();
    await signOutUser();
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
    prompt,
    save,
    resolve,
    signOut,
    removeAccount,
  };
}
