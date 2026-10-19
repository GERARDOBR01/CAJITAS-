// Notices on this phone when the partner does something (Web Push). On an
// iPhone they need Guardadito added to the home screen (iOS 16.4+).
import { cloud } from "./firebase.js";
import { pushConfigured, pushOrigin, vapidPublicKey } from "./config.js";

const SW_WAIT_MS = 6000;

/** install · unsupported · denied · ask · granted */
export function pushState() {
  if (
    !("serviceWorker" in navigator) ||
    !("PushManager" in window) ||
    !("Notification" in window)
  ) {
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
    const standalone =
      navigator.standalone || matchMedia("(display-mode: standalone)").matches;
    return ios && !standalone ? "install" : "unsupported";
  }
  return (
    { denied: "denied", granted: "granted" }[Notification.permission] ?? "ask"
  );
}

function keyBytes(base64) {
  const raw = atob(
    (base64 + "=".repeat((4 - (base64.length % 4)) % 4))
      .replace(/-/g, "+")
      .replace(/_/g, "/"),
  );
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}
async function deviceId(endpoint) {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(endpoint),
  );
  return [...new Uint8Array(hash).slice(0, 20)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
async function worker() {
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise((_, reject) =>
      setTimeout(
        () =>
          reject(
            new Error(
              "Los avisos funcionan en la app instalada. Ábrela desde tu pantalla de inicio.",
            ),
          ),
        SW_WAIT_MS,
      ),
    ),
  ]);
}

async function save(pairId, uid, subscription) {
  const { db, storeLib: s } = await cloud();
  const json = subscription.toJSON();
  await s.setDoc(
    s.doc(db, "pairs", pairId, "devices", await deviceId(json.endpoint)),
    {
      uid,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
      updatedAt: Date.now(),
    },
  );
}

/** Asks for permission (needs a tap) and registers this phone. */
export async function enablePush(pairId, uid) {
  const permission = await Notification.requestPermission();
  if (permission !== "granted")
    throw new Error(
      "Sin permiso no podemos avisarte. Puedes activarlo en los ajustes del teléfono.",
    );
  const registration = await worker();
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: keyBytes(vapidPublicKey),
    }));
  await save(pairId, uid, subscription);
}

/** With permission already given, keeps this phone registered. */
export async function refreshPush(pairId, uid) {
  if (pushState() !== "granted") return false;
  const registration = await worker();
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return false;
  await save(pairId, uid, subscription);
  return true;
}

export async function disablePush(pairId) {
  const registration = await worker();
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;
  const { db, storeLib: s } = await cloud();
  await s
    .deleteDoc(
      s.doc(
        db,
        "pairs",
        pairId,
        "devices",
        await deviceId(subscription.endpoint),
      ),
    )
    .catch(() => {});
  await subscription.unsubscribe();
}

/** Tells the partner's phones; never blocks or fails what the user did. */
export async function notifyPartner(pairId, kind, id) {
  if (!id || !pushConfigured) return;
  try {
    const { auth } = await cloud();
    const token = await auth.currentUser?.getIdToken();
    if (!token) return;
    await fetch(`${pushOrigin}/api/push`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ pairId, kind, id }),
    });
  } catch {
    /* A notice is a courtesy; the app already shows it inside. */
  }
}
