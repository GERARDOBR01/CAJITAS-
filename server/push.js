// Avisos al teléfono de la pareja (Web Push). The server only holds the
// VAPID private key: it reads the couple's data with the caller's own
// Firebase session, so Firestore's rules decide what it may see, and it
// writes the message itself, so nobody can send arbitrary text.
import webpush from "web-push";
import { createRemoteJWKSet, decodeJwt, jwtVerify } from "jose";

const problem = (message, status = 400) =>
  Object.assign(new Error(message), { status });
const FRESH_MS = 10 * 60 * 1000;
const project = () =>
  process.env.FIREBASE_PROJECT_ID ??
  (emulated() ? "demo-guardadito" : "guardadito-94c49");
const emulated = () =>
  Boolean(process.env.FIRESTORE_EMULATOR_HOST) &&
  process.env.NODE_ENV !== "production";
const googleKeys = createRemoteJWKSet(
  new URL(
    "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com",
  ),
);

const money = (cents) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2,
  }).format(cents / 100);

// Only the push services browsers really use (as firestore.rules says), so a
// stored address can never make this server call anywhere else.
const PUSH_HOSTS =
  /^(fcm\.googleapis\.com|web\.push\.apple\.com|updates\.push\.services\.mozilla\.com|[a-z0-9-]+\.notify\.windows\.com)$/;
export function knownPushService(endpoint) {
  try {
    const url = new URL(endpoint);
    return url.protocol === "https:" && PUSH_HOSTS.test(url.hostname);
  } catch {
    return false;
  }
}

/** The signed-in Firebase user behind a bearer token. */

export async function verifyUser(authorization) {
  const token = /^Bearer (.+)$/.exec(authorization ?? "")?.[1];
  if (!token) throw problem("Inicia sesión para mandar avisos.", 401);
  try {
    // The emulator signs nothing; never trusted outside local tests.
    const claims = emulated()
      ? decodeJwt(token)
      : (
          await jwtVerify(token, googleKeys, {
            issuer: `https://securetoken.google.com/${project()}`,
            audience: project(),
          })
        ).payload;
    if (typeof claims.sub !== "string" || !claims.sub) throw new Error();
    return { uid: claims.sub, token };
  } catch {
    throw problem("Tu sesión venció. Vuelve a entrar.", 401);
  }
}

function value(v) {
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("nullValue" in v) return null;
  if ("arrayValue" in v) return (v.arrayValue.values ?? []).map(value);
  if ("mapValue" in v) return fields(v.mapValue.fields ?? {});
  return undefined;
}
const fields = (f) =>
  Object.fromEntries(Object.entries(f).map(([k, v]) => [k, value(v)]));

/** Firestore over REST as the caller: the same rules as in the app. */
export function firestore(token, fetchImpl = fetch) {
  const root = emulated()
    ? `http://${process.env.FIRESTORE_EMULATOR_HOST}`
    : "https://firestore.googleapis.com";
  const base = `${root}/v1/projects/${project()}/databases/(default)/documents`;
  const call = (path, init = {}) =>
    fetchImpl(`${base}/${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(8000),
    });
  return {
    async get(path) {
      const response = await call(path);
      if (response.status === 404 || response.status === 403) return null;
      if (!response.ok) throw problem("No se pudo leer el aviso.", 502);
      const doc = await response.json();
      return { id: doc.name.split("/").pop(), ...fields(doc.fields ?? {}) };
    },
    async list(parent, collection, field, equals) {
      const response = await call(`${parent}:runQuery`, {
        method: "POST",
        body: JSON.stringify({
          structuredQuery: {
            from: [{ collectionId: collection }],
            where: {
              fieldFilter: {
                field: { fieldPath: field },
                op: "EQUAL",
                value: { stringValue: equals },
              },
            },
            limit: 10,
          },
        }),
      });
      if (!response.ok) return [];
      return (await response.json())
        .filter((row) => row.document)
        .map((row) => ({
          id: row.document.name.split("/").pop(),
          ...fields(row.document.fields ?? {}),
        }));
    },
    async remove(path) {
      await call(path, { method: "DELETE" }).catch(() => {});
    },
  };
}

const fresh = (at, now) =>
  Number.isFinite(at) && at <= now + 60000 && now - at < FRESH_MS;

/**
 * What to tell whom after `caller` did something: always written here from
 * the stored record, and only while it is recent.
 */
export function messageFor({ kind, item, caller, pair, goalName, now }) {
  const other = pair.members.find((m) => m !== caller);
  const name = pair.names?.[caller] || "Tu pareja";
  const amount =
    item && Number.isFinite(item.cents) && money(Math.abs(item.cents));
  if (!item || !other) return null;
  if (kind === "deposit") {
    if (
      item.status === "pending" &&
      item.from === caller &&
      item.to === other
    ) {
      if (!fresh(item.createdAt, now)) return null;
      return {
        to: other,
        title: "Por confirmar",
        body:
          item.cents > 0
            ? `${name} dice que te mandó ${amount} para ${item.goalName}. ¿Te llegó?`
            : `${name} te pide ${amount} de ${item.goalName}.`,
      };
    }
    if (
      item.to === caller &&
      item.from === other &&
      fresh(item.decidedAt, now)
    ) {
      const yes = item.status === "confirmed";
      if (!yes && item.status !== "rejected") return null;
      return {
        to: other,
        title: yes ? "¡Confirmado! 💞" : "Todavía no",
        body: yes
          ? item.cents > 0
            ? `${name} confirmó tu depósito: +${amount} para ${item.goalName}.`
            : `${name} confirmó tu retiro de ${amount}.`
          : item.cents > 0
            ? `${name} todavía no ve tus ${amount}. Revisa la transferencia.`
            : `${name} no pudo darte ${amount} por ahora.`,
      };
    }
    return null;
  }
  if (kind === "gift") {
    if (
      item.from !== caller ||
      item.to !== other ||
      !fresh(item.createdAt, now)
    )
      return null;
    const body = {
      pet: `${name} te mandó una mascota especial 🐾`,
      note: `${name} te dejó una notita 💌`,
      reward: `${name} te preparó un premio 🎁 Se abre al llegar al ${item.threshold} % de ${item.goalName}.`,
    }[item.kind];
    return body ? { to: other, title: "Una sorpresa para ti", body } : null;
  }
  if (kind === "entry") {
    if (item.by !== caller || !(item.cents > 0) || !fresh(item.createdAt, now))
      return null;
    return {
      to: other,
      title: "¡Un pasito juntos!",
      body: `${name} apartó ${amount} para ${goalName || "su cajita"} 🎉`,
    };
  }
  return null;
}

const COLLECTION = { deposit: "deposits", gift: "gifts", entry: "entries" };
const recent = new Map();
function once(key, now) {
  for (const [k, at] of recent) if (now - at > FRESH_MS) recent.delete(k);
  if (recent.has(key)) return false;
  recent.set(key, now);
  return true;
}

/** POST /api/push {pairId, kind, id}: tells the partner's phones. */
export async function sendPush(
  authorization,
  body,
  { send = webpush.sendNotification, fetchImpl = fetch, now = Date.now() } = {},
) {
  const publicKey = process.env.VAPID_PUBLIC_KEY,
    privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey)
    throw problem("Los avisos no están configurados en el servidor.", 503);
  const { pairId, kind, id } = body ?? {};
  if (
    typeof pairId !== "string" ||
    !/^[\w-]{1,200}$/.test(pairId) ||
    !COLLECTION[kind] ||
    typeof id !== "string" ||
    !/^[\w-]{1,200}$/.test(id)
  )
    throw problem("Aviso inválido.");
  const { uid, token } = await verifyUser(authorization);
  const db = firestore(token, fetchImpl);
  const pair = await db.get(`pairs/${pairId}`);
  if (!pair?.members?.includes(uid))
    throw problem("No perteneces a esta pareja.", 403);
  const item = await db.get(`pairs/${pairId}/${COLLECTION[kind]}/${id}`);
  const goalName =
    kind === "entry" && item?.goalId
      ? (await db.get(`pairs/${pairId}/goals/${item.goalId}`))?.name
      : "";
  const message = messageFor({ kind, item, caller: uid, pair, goalName, now });
  if (!message || !once(`${pairId}/${kind}/${id}/${item.status ?? ""}`, now))
    return { sent: 0 };
  const devices = await db.list(
    `pairs/${pairId}`,
    "devices",
    "uid",
    message.to,
  );
  const payload = JSON.stringify({
    title: message.title,
    body: message.body,
    tag: `${kind}-${id}`,
  });
  let sent = 0;
  await Promise.all(
    devices
      .filter((device) => knownPushService(device.endpoint))
      .map(async (device) => {
        try {
          await send(
            {
              endpoint: device.endpoint,
              keys: { p256dh: device.p256dh, auth: device.auth },
            },
            payload,
            {
              TTL: 86400,
              urgency: "high",
              vapidDetails: {
                subject: "https://gerardobr01.github.io/CAJITAS-/",
                publicKey,
                privateKey,
              },
            },
          );
          sent++;
        } catch (error) {
          // The phone dropped this subscription: forget it.
          if ([404, 410].includes(error.statusCode))
            await db.remove(`pairs/${pairId}/devices/${device.id}`);
        }
      }),
  );
  return { sent };
}
