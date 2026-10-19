import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
export const isNative = Capacitor.isNativePlatform();
export const platform = Capacitor.getPlatform();
const nativeSessionKey = "guardadito:native-session";
const webSessionKey = "guardadito:web-session:";
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
export function apiOrigin() {
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
export function externalWeb(origin) {
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
