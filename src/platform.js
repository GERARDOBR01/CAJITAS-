import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
import { STORAGE_KEY, validateBackup } from "./domain.js";
import { nextOccurrences, upcomingNotifications } from "./pet/reminders.js";
export const isNative = Capacitor.isNativePlatform();
export const platform = Capacitor.getPlatform();
const nativeSessionKey = "guardadito:native-session";
const nativeProofKey = "guardadito:native-oauth";
const webSessionKey = "guardadito:web-session:";
const webProofKey = "guardadito:web-oauth:";
let connectionResult;
export function consumeConnectionResult() {
  const result = connectionResult;
  connectionResult = null;
  return result;
}
function announceConnection(detail) {
  connectionResult = detail;
  window.dispatchEvent(new CustomEvent("guardadito:connection", { detail }));
}
let nativeSession;
let installPrompt;
if (typeof window !== "undefined" && !isNative)
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event;
    window.dispatchEvent(new Event("guardadito:install"));
  });
export const getInstallPrompt = () => installPrompt;
export const clearInstallPrompt = () => {
  installPrompt = null;
};
export async function hydrateSavings() {
  if (!isNative) return;
  const native = (await Preferences.get({ key: STORAGE_KEY })).value,
    local = localStorage.getItem(STORAGE_KEY);
  function parsed(raw) {
    try {
      return raw ? validateBackup(JSON.parse(raw)) : null;
    } catch {
      return null;
    }
  }
  const n = parsed(native),
    l = parsed(local);
  const selected = n && (!l || n.savedAt > l.savedAt) ? native : local;
  if (selected) {
    localStorage.setItem(STORAGE_KEY, selected);
    await Preferences.set({ key: STORAGE_KEY, value: selected });
  }
}
export async function persistSavings(raw) {
  if (isNative) await Preferences.set({ key: STORAGE_KEY, value: raw });
}
function apiOrigin() {
  const configured = import.meta.env.VITE_API_ORIGIN;
  if (!configured && !isNative) return "";
  if (!configured)
    throw new Error(
      "Las conexiones aún no están habilitadas en esta instalación. Tus cajitas funcionan sin conexión.",
    );
  let url;
  try {
    url = new URL(configured);
  } catch {
    throw new Error(
      "La dirección de las conexiones de esta instalación no es válida.",
    );
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    (!isNative &&
      (!url.hostname.includes(".") ||
        /^[\d.]+$/.test(url.hostname) ||
        url.hostname.includes(":") ||
        /(^|\.)(localhost|local|internal|test|invalid|example)$/.test(
          url.hostname,
        )))
  )
    throw new Error(
      "La dirección de las conexiones de esta instalación no es válida.",
    );
  return url.origin;
}
function externalWeb(origin) {
  return !isNative && Boolean(origin) && origin !== window.location.origin;
}
function unavailableStatus() {
  return {
    apiConfigured: false,
    gmailConnected: false,
    gmailConfigured: false,
    gmailReadiness: { ready: false, missing: ["VITE_API_ORIGIN"] },
    bitsoAuthorized: false,
    bitsoConfigured: false,
    patternsValidated: false,
  };
}
export async function api(path, body) {
  if (
    !import.meta.env.VITE_API_ORIGIN &&
    (isNative || import.meta.env.MODE === "pages")
  ) {
    if (path === "status") return unavailableStatus();
    throw new Error(
      "Las conexiones aún no están habilitadas en esta instalación. Puedes usar tus cajitas y comparar la tasa que captures.",
    );
  }
  let origin;
  try {
    origin = apiOrigin();
  } catch (error) {
    if (path === "status") return unavailableStatus();
    throw error;
  }
  const web = externalWeb(origin);
  if (isNative && nativeSession === undefined)
    nativeSession = (await Preferences.get({ key: nativeSessionKey })).value;
  const session = isNative
    ? nativeSession
    : web
      ? sessionStorage.getItem(webSessionKey + origin)
      : null;
  const response = await fetch(`${origin}/api/${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(session ? { Authorization: `Bearer ${session}` } : {}),
    },
    credentials: web || isNative ? "omit" : "same-origin",
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(60000),
  });
  const data = await response.json().catch(() => {
    throw new Error("El servidor de conexiones no respondió correctamente.");
  });
  if (!response.ok)
    throw new Error(data.error ?? "No se pudo completar la consulta.");
  if ((isNative || web) && data.sessionId) {
    if (!/^[a-f0-9]{64}$/.test(data.sessionId))
      throw new Error("La sesión del servidor no es válida.");
    if (isNative) {
      nativeSession = data.sessionId;
      await Preferences.set({ key: nativeSessionKey, value: nativeSession });
    } else sessionStorage.setItem(webSessionKey + origin, data.sessionId);
  }
  return data;
}
export async function openExternal(url) {
  if (isNative) {
    const { Browser } = await import("@capacitor/browser");
    await Browser.open({ url });
  } else window.open(url, "_blank", "noopener,noreferrer");
}
export async function haptic(celebrate = false) {
  if (!isNative) return;
  try {
    const { Haptics, ImpactStyle, NotificationType } =
      await import("@capacitor/haptics");
    if (celebrate)
      await Haptics.notification({ type: NotificationType.Success });
    else await Haptics.impact({ style: ImpactStyle.Light });
  } catch {
    /* Haptics are optional on unsupported devices. */
  }
}
export async function saveFile(text, filename, type = "application/json") {
  if (isNative) {
    const { Filesystem, Directory, Encoding } =
      await import("@capacitor/filesystem");
    const { Share } = await import("@capacitor/share");
    const result = await Filesystem.writeFile({
      path: `cajitas/${filename}`,
      data: text,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
      recursive: true,
    });
    await Share.share({
      title: "Tus cajitas",
      url: result.uri,
      dialogTitle: "Guardar o compartir tu respaldo",
    });
  } else {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
export async function connectGmail() {
  // Static builds without a backend must never navigate to a nonexistent /api.
  if (
    !import.meta.env.VITE_API_ORIGIN &&
    (isNative || import.meta.env.MODE === "pages")
  )
    throw new Error(
      "Las conexiones aún no están habilitadas en esta instalación. Tus cajitas funcionan sin conexión.",
    );
  const origin = apiOrigin(),
    web = externalWeb(origin);
  if (!isNative && !web) {
    window.location.assign(`${origin}/api/gmail/connect`);
    return;
  }
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const verifier = Array.from(bytes, (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );
  const challenge = Array.from(new Uint8Array(hash), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
  const { url } = await api(web ? "gmail/app-start" : "gmail/native-start", {
    challenge,
    ...(web
      ? {
          callbackUrl: new URL(
            import.meta.env.BASE_URL || "/",
            window.location.origin,
          ).href,
        }
      : {}),
  });
  const target = new URL(url);
  if (
    target.origin !== origin ||
    target.pathname !== "/api/gmail/connect" ||
    target.username ||
    target.password
  )
    throw new Error("El enlace de conexión del servidor no es válido.");
  const proof = JSON.stringify({ verifier, expires: Date.now() + 600000 });
  if (web) {
    sessionStorage.setItem(webProofKey + origin, proof);
    window.location.assign(target.href);
  } else {
    await Preferences.set({ key: nativeProofKey, value: proof });
    await openExternal(target.href);
  }
}
async function handleWebConnection() {
  const fragment = new URLSearchParams(window.location.hash.slice(1));
  if (!fragment.has("cajitas-auth") && !fragment.has("cajitas-auth-error"))
    return;
  // Remove the one-use code before any network call or UI event can expose it.
  history.replaceState(
    history.state,
    "",
    window.location.pathname + window.location.search,
  );
  let origin;
  try {
    origin = apiOrigin();
    if (!externalWeb(origin))
      throw new Error("Esta instalación no tiene configurada la conexión web.");
    const raw = sessionStorage.getItem(webProofKey + origin);
    const proof = raw ? JSON.parse(raw) : null;
    if (
      !proof ||
      !Number.isFinite(proof.expires) ||
      proof.expires < Date.now() ||
      !/^[a-f0-9]{64}$/.test(proof.verifier ?? "")
    )
      throw new Error("La conexión expiró. Conecta Gmail de nuevo.");
    if (fragment.has("cajitas-auth-error"))
      throw new Error("La conexión de Gmail fue cancelada.");
    const code = fragment.get("cajitas-auth");
    if (!/^[a-f0-9]{64}$/.test(code ?? ""))
      throw new Error("El enlace de conexión no es válido.");
    await api("gmail/app-exchange", { code, verifier: proof.verifier });
    announceConnection({ connected: true });
  } catch (error) {
    announceConnection({ error: error.message });
  } finally {
    if (origin) sessionStorage.removeItem(webProofKey + origin);
  }
}
export async function setupNativeEvents() {
  if (!isNative) return handleWebConnection();
  const { App } = await import("@capacitor/app");
  async function handle({ url: raw }) {
    let url;
    try {
      url = new URL(raw);
    } catch {
      return;
    }
    if (url.protocol !== "guardadito:" || url.hostname !== "auth") return;
    try {
      const proofRaw = (await Preferences.get({ key: nativeProofKey })).value;
      const proof = proofRaw ? JSON.parse(proofRaw) : null;
      if (
        !proof ||
        !Number.isFinite(proof.expires) ||
        proof.expires < Date.now() ||
        !/^[a-f0-9]{64}$/.test(proof.verifier ?? "")
      )
        throw new Error("La conexión expiró. Conecta Gmail de nuevo.");
      if (url.searchParams.has("error"))
        throw new Error("La conexión de Gmail fue cancelada.");
      const code = url.searchParams.get("code");
      if (!/^[a-f0-9]{64}$/.test(code ?? ""))
        throw new Error("El enlace de conexión no es válido.");
      await api("gmail/native-exchange", { code, verifier: proof.verifier });
      announceConnection({ connected: true });
    } catch (error) {
      announceConnection({ error: error.message });
    } finally {
      await Preferences.remove({ key: nativeProofKey });
      const { Browser } = await import("@capacitor/browser");
      await Browser.close().catch(() => {});
    }
  }
  await App.addListener("appUrlOpen", handle);
  const initial = await App.getLaunchUrl();
  if (initial) await handle(initial);
  await App.addListener("backButton", ({ canGoBack }) => {
    const dialog = document.querySelector("dialog[open]");
    if (dialog) dialog.dispatchEvent(new Event("cancel", { cancelable: true }));
    else if (canGoBack) history.back();
    else window.dispatchEvent(new Event("guardadito:back"));
  });
}
const LEGACY_REMINDER_ID = 71401;
const REMINDER_IDS = Array.from({ length: 12 }, (_, i) => 71500 + i);
let reminderListeners = false;

/** Ask for permission once, when the person turns reminders on. */
export async function allowReminders() {
  if (!isNative) return;
  const { LocalNotifications } = await import("@capacitor/local-notifications");
  const permission = await LocalNotifications.requestPermissions();
  if (permission.display !== "granted")
    throw new Error(
      "No se activó el recordatorio. Puedes permitir las notificaciones en los ajustes de tu dispositivo.",
    );
}

/** Replace the scheduled notifications with the next ones for this data.
 * Each one is a single dated notification so quincenas and rotating messages
 * stay exact. Returns the ids of the messages used, to avoid repeats. */
export async function syncReminders(data, now = new Date()) {
  const plan = upcomingNotifications(data, now);
  if (!isNative) return plan.recent;
  const { LocalNotifications } = await import("@capacitor/local-notifications");
  await LocalNotifications.cancel({
    notifications: [LEGACY_REMINDER_ID, ...REMINDER_IDS].map((id) => ({ id })),
  });
  if (!plan.items.length) return plan.recent;
  const { display } = await LocalNotifications.checkPermissions();
  if (display !== "granted") return plan.recent;
  await LocalNotifications.schedule({
    notifications: plan.items.map((item) => ({
      id: item.id,
      title: item.title,
      body: item.body,
      schedule: { at: item.at, allowWhileIdle: false },
      actionTypeId: "cajitas-checkin",
      extra: { goalId: item.goalId },
    })),
  });
  return plan.recent;
}

/** Tapping a reminder opens the record dialog of that cajita; "Ahora no" only
 * acknowledges it. */
export async function listenToReminders(onAction) {
  if (!isNative || reminderListeners) return;
  reminderListeners = true;
  const { LocalNotifications } = await import("@capacitor/local-notifications");
  await LocalNotifications.registerActionTypes({
    types: [
      {
        id: "cajitas-checkin",
        actions: [
          { id: "save", title: "Registrar ahorro", foreground: true },
          { id: "later", title: "Ahora no", foreground: false },
        ],
      },
    ],
  });
  await LocalNotifications.addListener(
    "localNotificationActionPerformed",
    ({ actionId, notification }) =>
      onAction({
        action: actionId === "later" ? "later" : "save",
        goalId: notification.extra?.goalId,
      }),
  );
}
export function reminderCalendar(reminder, now = new Date()) {
  const frequency = reminder.frequency ?? "weekly";
  // The first event is the same next reminder the app and the plan use.
  const [date] = nextOccurrences({ ...reminder, frequency }, now, 1);
  const stamp = (d) =>
    `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}00`;
  const rule = {
    weekly: `RRULE:FREQ=WEEKLY;BYDAY=${["SU", "MO", "TU", "WE", "TH", "FR", "SA"][reminder.day]}`,
    biweekly: "RRULE:FREQ=MONTHLY;BYMONTHDAY=15,-1",
    monthly: "RRULE:FREQ=MONTHLY;BYMONTHDAY=-1",
  }[frequency];
  const summary = {
    weekly: "Un ratito para tus cajitas",
    biweekly: "Quincena: un ratito para tus cajitas",
    monthly: "Fin de mes: un ratito para tus cajitas",
  }[frequency];
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Guardadito//Ahorro//ES",
    "BEGIN:VEVENT",
    `UID:guardadito-${frequency}-reminder@mx.guardadito.ahorro`,
    `DTSTAMP:${now
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "")}`,
    `DTSTART:${stamp(date)}`,
    rule,
    "DURATION:PT10M",
    `SUMMARY:${summary}`,
    "DESCRIPTION:Abre Guardadito y registra lo que apartaste. Sin transferencias automaticas.",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}
