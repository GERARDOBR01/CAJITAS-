import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
import { STORAGE_KEY, validateBackup } from "./domain.js";
export const isNative = Capacitor.isNativePlatform();
export const platform = Capacitor.getPlatform();
const nativeSessionKey = "cajitas:native-session";
const nativeProofKey = "cajitas:native-oauth";
let nativeSession;
let installPrompt;
if (typeof window !== "undefined" && !isNative)
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event;
    window.dispatchEvent(new Event("cajitas:install"));
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
  if (!isNative) return "";
  const configured = import.meta.env.VITE_API_ORIGIN;
  if (!configured)
    throw new Error(
      "Las conexiones aún no están habilitadas en esta instalación. Tus cajitas funcionan sin conexión.",
    );
  const url = new URL(configured);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new Error(
      "La dirección de las conexiones de esta instalación no es válida.",
    );
  return url.origin;
}
export async function api(path, body) {
  if (!isNative && import.meta.env.MODE === "pages") {
    if (path === "status")
      return {
        gmailConnected: false,
        gmailConfigured: false,
        bitsoAuthorized: false,
        bitsoConfigured: false,
        patternsValidated: false,
      };
    throw new Error(
      "Las consultas externas aún no están habilitadas en esta versión web. Puedes usar tus cajitas y comparar la tasa que captures.",
    );
  }
  if (isNative && nativeSession === undefined)
    nativeSession = (await Preferences.get({ key: nativeSessionKey })).value;
  const response = await fetch(`${apiOrigin()}/api/${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(isNative && nativeSession
        ? { Authorization: `Bearer ${nativeSession}` }
        : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(60000),
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error ?? "No se pudo completar la consulta.");
  if (isNative && data.sessionId) {
    nativeSession = data.sessionId;
    await Preferences.set({ key: nativeSessionKey, value: nativeSession });
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
    const { Haptics, ImpactStyle, NotificationType } = await import(
      "@capacitor/haptics"
    );
    if (celebrate)
      await Haptics.notification({ type: NotificationType.Success });
    else await Haptics.impact({ style: ImpactStyle.Light });
  } catch {
    /* Haptics are optional on unsupported devices. */
  }
}
export async function saveFile(text, filename, type = "application/json") {
  if (isNative) {
    const { Filesystem, Directory, Encoding } = await import(
      "@capacitor/filesystem"
    );
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
  if (!isNative) {
    location.assign("/api/gmail/connect");
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
  const { url } = await api("gmail/native-start", { challenge });
  await Preferences.set({
    key: nativeProofKey,
    value: JSON.stringify({ verifier, expires: Date.now() + 600000 }),
  });
  await openExternal(url);
}
export async function setupNativeEvents() {
  if (!isNative) return;
  const { App } = await import("@capacitor/app");
  async function handle({ url: raw }) {
    let url;
    try {
      url = new URL(raw);
    } catch {
      return;
    }
    if (url.protocol !== "cajitas:" || url.hostname !== "auth") return;
    try {
      const proofRaw = (await Preferences.get({ key: nativeProofKey })).value;
      const proof = proofRaw ? JSON.parse(proofRaw) : null;
      if (!proof || proof.expires < Date.now())
        throw new Error("La conexión expiró. Conecta Gmail de nuevo.");
      if (url.searchParams.has("error"))
        throw new Error("La conexión de Gmail fue cancelada.");
      const code = url.searchParams.get("code");
      if (!/^[a-f0-9]{64}$/.test(code ?? ""))
        throw new Error("El enlace de conexión no es válido.");
      await api("gmail/native-exchange", { code, verifier: proof.verifier });
      window.dispatchEvent(
        new CustomEvent("cajitas:connection", { detail: { connected: true } }),
      );
    } catch (error) {
      window.dispatchEvent(
        new CustomEvent("cajitas:connection", {
          detail: { error: error.message },
        }),
      );
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
    else window.dispatchEvent(new Event("cajitas:back"));
  });
}
export async function configureReminder(reminder) {
  if (!isNative) return;
  const { LocalNotifications } = await import("@capacitor/local-notifications");
  if (reminder.enabled) {
    const permission = await LocalNotifications.requestPermissions();
    if (permission.display !== "granted")
      throw new Error(
        "No se activó el recordatorio. Puedes permitir las notificaciones en los ajustes de tu dispositivo.",
      );
  }
  await LocalNotifications.cancel({ notifications: [{ id: 71401 }] });
  if (reminder.enabled) {
    const [hour, minute] = reminder.time.split(":").map(Number);
    await LocalNotifications.schedule({
      notifications: [
        {
          id: 71401,
          title: "Un ratito para tus sueños ✦",
          body: "Revisa tus cajitas y decide si hoy puedes dar un pasito. Tú marcas el ritmo.",
          schedule: {
            on: { weekday: reminder.day + 1, hour, minute },
            repeats: true,
            allowWhileIdle: false,
          },
          isExactNotification: false,
        },
      ],
    });
  }
}
export function reminderCalendar(reminder, now = new Date()) {
  const [hours, minutes] = reminder.time.split(":").map(Number),
    date = new Date(now);
  date.setHours(hours, minutes, 0, 0);
  date.setDate(date.getDate() + ((reminder.day - date.getDay() + 7) % 7));
  if (date <= now) date.setDate(date.getDate() + 7);
  const stamp = (d) =>
    `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}00`;
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Cajitas//Ahorro//ES",
    "BEGIN:VEVENT",
    "UID:cajitas-weekly-reminder@mx.cajitas.ahorro",
    `DTSTAMP:${now
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "")}`,
    `DTSTART:${stamp(date)}`,
    `RRULE:FREQ=WEEKLY;BYDAY=${["SU", "MO", "TU", "WE", "TH", "FR", "SA"][reminder.day]}`,
    "DURATION:PT10M",
    "SUMMARY:Un ratito para tus cajitas",
    "DESCRIPTION:Revisa tu plan y decide si hoy puedes dar un pasito. Sin transferencias automaticas.",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}
