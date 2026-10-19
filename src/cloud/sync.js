import { validateBackup } from "../domain.js";

/** Which account the journal on this device belongs to. */
export const CLOUD_UID_KEY = "guardadito:cloud-uid";

export function hasContent(data) {
  return Boolean(data && (data.goals.length || data.checkins.length));
}

export function toCloud(data) {
  return {
    raw: JSON.stringify(data),
    savedAt: data.savedAt ?? 0,
    version: data.version,
  };
}

/** A cloud document back to journal data; throws if it is damaged. */
export function fromCloud(doc) {
  if (!doc || typeof doc.raw !== "string")
    throw new Error("La copia de tu cuenta está incompleta.");
  const data = validateBackup(JSON.parse(doc.raw));
  return { ...data, savedAt: data.savedAt ?? doc.savedAt ?? 0 };
}

/** Newest copy wins: same account on two devices, last saved change. */
export function reconcile(local, remote) {
  const l = local?.savedAt ?? 0,
    r = remote?.savedAt ?? 0;
  return r > l ? "pull" : l > r ? "push" : "none";
}

/**
 * What to do the first time an account and this device meet. Cajitas on a
 * device are never sent to an account, or replaced by an account's, without
 * asking — unless the device already belongs to that same account.
 * @returns "push" | "pull" | "none" | "ask-upload" | "ask-choose"
 */
export function firstSync({ local, remote, linkedUid, uid }) {
  const mine = linkedUid === uid;
  if (!remote) return hasContent(local) && !mine ? "ask-upload" : "push";
  if (!hasContent(local) || mine) return reconcile(local, remote);
  if (!hasContent(remote)) return "push";
  return JSON.stringify(local.goals) === JSON.stringify(remote.goals)
    ? reconcile(local, remote)
    : "ask-choose";
}

const AUTH_ERRORS = {
  "auth/email-already-in-use":
    "Ese correo ya tiene cuenta. Entra con tu contraseña.",
  "auth/invalid-email": "Revisa el correo.",
  "auth/invalid-credential": "El correo o la contraseña no coinciden.",
  "auth/wrong-password": "El correo o la contraseña no coinciden.",
  "auth/user-not-found": "El correo o la contraseña no coinciden.",
  "auth/weak-password": "Usa una contraseña de al menos 8 caracteres.",
  "auth/too-many-requests":
    "Muchos intentos seguidos. Espera unos minutos y vuelve a intentar.",
  "auth/network-request-failed":
    "Sin conexión. Revisa tu internet y vuelve a intentar.",
  "auth/requires-recent-login":
    "Por seguridad, escribe de nuevo tu contraseña.",
};

export function authMessage(error) {
  return (
    AUTH_ERRORS[error?.code] ??
    error?.message ??
    "Algo salió mal. Intenta de nuevo."
  );
}
