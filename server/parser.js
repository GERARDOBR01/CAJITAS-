import { createHash } from "node:crypto";
export const PATTERNS = [
  { id: "nu-deposit-v1", provider: "Nu", validated: false },
  { id: "mp-deposit-v1", provider: "Mercado Pago", validated: false },
];
export function senderAddress(value) {
  const match = String(value)
    .trim()
    .match(
      /^(?:[^<>]*<)?([a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,})(?:>)?$/i,
    );
  return match?.[1].toLowerCase() ?? null;
}
export function configuredSenders(env = process.env) {
  return {
    Nu: (env.GMAIL_NU_SENDERS ?? "")
      .split(",")
      .map((x) => x.trim().toLowerCase())
      .filter((x) => senderAddress(x) === x),
    "Mercado Pago": (env.GMAIL_MP_SENDERS ?? "")
      .split(",")
      .map((x) => x.trim().toLowerCase())
      .filter((x) => senderAddress(x) === x),
  };
}
function header(message, key) {
  return (
    message.payload?.headers?.find(
      (h) => h.name.toLowerCase() === key.toLowerCase(),
    )?.value ?? ""
  );
}
function textParts(part) {
  if (!part) return [];
  if (part.mimeType === "text/plain" || part.mimeType === "text/html") {
    const text = Buffer.from(part.body?.data ?? "", "base64url").toString(
      "utf8",
    );
    return [{ type: part.mimeType, text }];
  }
  return (part.parts ?? []).flatMap(textParts);
}
export function parseDeposit(
  message,
  { senders = configuredSenders(), requireAuthentication = true } = {},
) {
  const address = senderAddress(header(message, "from"));
  const provider = Object.keys(senders).find((p) =>
    senders[p].includes(address),
  );
  if (!provider || !message.id) return null;
  if (requireAuthentication) {
    // Gmail inserts Authentication-Results at the top; require aligned DKIM from Google.
    const auth = header(message, "authentication-results");
    const domain = address.split("@")[1];
    const escaped = domain.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (
      !/^(?:mx\.)?google\.com[;\s]/i.test(auth) ||
      !new RegExp(
        `dkim=pass[^;]*header\\.(?:i=@|d=)${escaped}(?:[;\\s]|$)`,
        "i",
      ).test(auth)
    )
      return null;
  }
  const parts = textParts(message.payload);
  const plain = parts.filter((p) => p.type === "text/plain");
  const source = (plain.length ? plain : parts).map((p) => p.text).join(" ");
  const text = source
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/\s+/g, " ");
  const subject = header(message, "subject");
  if (
    !/(dep[oó]sito recibido|recibiste (?:un |una )?(?:dep[oó]sito|transferencia)|dinero recibido)/i.test(
      subject,
    )
  )
    return null;
  if (
    /(rechazad|pendiente|cancelad|fallid|devoluci[oó]n)/i.test(
      subject + " " + text,
    )
  )
    return null;
  const amounts = [
    ...text.matchAll(
      /(?:recibiste|dep[oó]sito(?: recibido)?(?: por| de)?|monto(?: recibido)?\s*:)\s*(?:de\s*)?\$\s*(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)\s*(MXN|pesos)\b/gi,
    ),
  ];
  const unique = [...new Set(amounts.map((m) => m[1].replaceAll(",", "")))];
  if (unique.length !== 1) return null;
  const amountCents = Math.round(Number(unique[0]) * 100);
  const at = Number(message.internalDate);
  if (
    !Number.isSafeInteger(amountCents) ||
    amountCents <= 0 ||
    amountCents > 1e11 ||
    !Number.isFinite(at) ||
    at <= 0 ||
    at > Date.now() + 86400000
  )
    return null;
  const pattern = PATTERNS.find((p) => p.provider === provider);
  // Hash provider + Gmail message ID; no names, subjects or email bodies leave the server.
  const id = createHash("sha256")
    .update(`${provider}:${message.id}`)
    .digest("hex");
  return {
    id,
    provider,
    patternId: pattern.id,
    validated: pattern.validated,
    amountCents,
    at: new Date(at).toISOString(),
  };
}
