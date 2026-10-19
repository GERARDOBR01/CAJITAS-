import { Preferences } from "@capacitor/preferences";
import {
  api,
  apiOrigin,
  externalWeb,
  isNative,
  openExternal,
} from "../platform.js";

const nativeProofKey = "guardadito:native-oauth";
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
export async function handleWebConnection() {
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

async function handleNativeLink({ url: raw }) {
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

/** The link Gmail's page sends the native app back with, also when the app
 * was started by it. */
export async function listenForGmailLink() {
  const { App } = await import("@capacitor/app");
  await App.addListener("appUrlOpen", handleNativeLink);
  const initial = await App.getLaunchUrl();
  if (initial) await handleNativeLink(initial);
}
