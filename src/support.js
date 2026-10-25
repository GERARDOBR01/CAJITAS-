// How people reach the person behind Guardadito, and where the app lives.

/** The public contact address. Empty until it exists: then the help screen
 * offers the GitHub page instead. */
export const CONTACT_EMAIL = "";
export const ISSUES_URL = "https://github.com/GERARDOBR01/CAJITAS-/issues/new";
export const WEB_URL = "https://gerardobr01.github.io/CAJITAS-/";
export const PRIVACY_URL = `${WEB_URL}privacidad.html`;
/** Google Play listing. Empty until the app is published there. */
export const PLAY_URL = "";

export const APP_VERSION =
  typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "dev";

/** A mailto link with the app version, the device and the recent errors, so
 * a report arrives with what is needed to understand it. */
export function supportMailto({ errors = [], platform = "web" } = {}) {
  if (!CONTACT_EMAIL) return "";
  const details = [
    "",
    "",
    "— Para ayudarte mejor (puedes borrar esto) —",
    `Versión: ${APP_VERSION} · ${platform}`,
    typeof navigator === "undefined" ? "" : navigator.userAgent,
    ...errors
      .slice(-5)
      .map((e) => `${new Date(e.at).toLocaleString("es-MX")}: ${e.message}`),
  ].join("\n");
  const params = new URLSearchParams({
    subject: "Guardadito: comentarios",
    body: details,
  });
  return `mailto:${CONTACT_EMAIL}?${params.toString().replace(/\+/g, "%20")}`;
}
