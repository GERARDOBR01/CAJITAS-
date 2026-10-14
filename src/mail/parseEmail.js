// Local files are untrusted text. This module never creates DOM nodes, loads
// remote resources, or interprets HTML, scripts, or authentication headers.
export const MAX_EMAIL_BYTES = 2 * 1024 * 1024;
const MAX_PARTS = 64;
const MAX_DEPTH = 12;
const MAX_HEADERS = 64 * 1024;
const MAX_PREVIEW = 2000;
const encoder = new TextEncoder();

function binary(bytes) {
  let result = "";
  for (let i = 0; i < bytes.length; i += 8192)
    result += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return result;
}

function bytes(value) {
  return Uint8Array.from(value, (character) => character.charCodeAt(0) & 255);
}

function addWarning(warnings, message) {
  if (!warnings.includes(message)) warnings.push(message);
}

function decodeBytes(value, charset, warnings) {
  const label = String(charset || "utf-8")
    .trim()
    .replace(/^['"]|['"]$/g, "");
  try {
    return new TextDecoder(label, { fatal: true }).decode(value);
  } catch {
    addWarning(
      warnings,
      "La codificación del correo no pudo verificarse; revisa el texto.",
    );
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(value);
    } catch {
      return new TextDecoder("windows-1252").decode(value);
    }
  }
}

function base64(value) {
  const compact = value.replace(/[\t\r\n ]/g, "");
  if (
    !/^[A-Za-z0-9+/]*={0,2}$/.test(compact) ||
    compact.length % 4 === 1 ||
    (compact.includes("=") && compact.length % 4 !== 0)
  )
    throw new Error("El correo contiene base64 inválido.");
  try {
    return bytes(atob(compact));
  } catch {
    throw new Error("El correo contiene base64 inválido.");
  }
}

function quotedPrintable(value, header = false) {
  const source = (header ? value.replaceAll("_", " ") : value).replace(
    /=\r?\n/g,
    "",
  );
  return bytes(
    source.replace(/=([\da-f]{2})/gi, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16)),
    ),
  );
}

function decodeHeader(value, warnings) {
  // RFC 2047 permits folded adjacent encoded words without a separating space.
  const joined = value.replace(/(\?=)[\t ]+(?==\?)/g, "$1");
  const result = joined.replace(
    /=\?([^?\s]+)\?([bq])\?([^?]*)\?=/gi,
    (word, charset, encoding, payload) => {
      try {
        return decodeBytes(
          encoding.toLowerCase() === "b"
            ? base64(payload)
            : quotedPrintable(payload, true),
          charset,
          warnings,
        );
      } catch {
        addWarning(
          warnings,
          "Un encabezado codificado no pudo leerse; revísalo manualmente.",
        );
        return "";
      }
    },
  );
  // Unencoded UTF-8 headers are common in exported mail. Decode only the raw
  // segments before RFC 2047 processing so decoded Unicode is never re-encoded.
  return result
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ")
    .trim();
}

function readHeaders(source, warnings) {
  const separator = /\r?\n\r?\n/.exec(source);
  const end = separator ? separator.index : source.length;
  if (end > MAX_HEADERS)
    throw new Error("Los encabezados del correo son demasiado grandes.");
  const headers = new Map();
  const unfolded = source.slice(0, end).replace(/\r?\n[\t ]+/g, " ");
  for (const line of unfolded.split(/\r?\n/)) {
    const match = /^([\x21-\x39\x3b-\x7e]+):[\t ]*(.*)$/.exec(line);
    if (!match) continue;
    const key = match[1].toLowerCase();
    if (headers.has(key)) {
      if (
        ["message-id", "date", "subject", "from", "content-type"].includes(key)
      )
        addWarning(
          warnings,
          "Hay encabezados repetidos; revisa los datos del correo.",
        );
      continue;
    }
    headers.set(key, match[2]);
  }
  return {
    headers,
    body: separator ? source.slice(end + separator[0].length) : "",
  };
}

function parameter(value, name) {
  const match = new RegExp(
    `(?:^|;)\\s*${name}\\s*=\\s*(?:"((?:\\\\.|[^"\\\\])*)"|([^;\\s]+))`,
    "i",
  ).exec(value);
  return match ? (match[1] ?? match[2]).replace(/\\(.)/g, "$1") : "";
}

function mimeParts(source, context, depth = 0) {
  if (++context.parts > MAX_PARTS)
    throw new Error("El correo tiene demasiadas partes MIME.");
  if (depth > MAX_DEPTH)
    throw new Error("El correo tiene demasiados niveles MIME.");
  const { headers, body } = readHeaders(source, context.warnings);
  const contentType = headers.get("content-type") || "text/plain";
  const type = contentType.split(";")[0].trim().toLowerCase();
  const disposition = headers.get("content-disposition") || "";
  if (
    /^attachment\b/i.test(disposition) ||
    /(?:^|;)\s*(?:filename\*?|name\*?)\s*=/i.test(
      `${disposition};${contentType}`,
    )
  )
    return [];
  if (type.startsWith("multipart/")) {
    const boundary = parameter(contentType, "boundary");
    if (!boundary || boundary.length > 200 || /[\r\n]/.test(boundary)) {
      addWarning(
        context.warnings,
        "No se pudo leer la estructura MIME; captura los datos manualmente.",
      );
      return [];
    }
    const parts = [];
    let current = null;
    let closed = false;
    for (const line of body.split(/\r?\n/)) {
      const marker = line.replace(/[\t ]+$/, "");
      if (marker === `--${boundary}` || marker === `--${boundary}--`) {
        if (current !== null)
          parts.push(...mimeParts(current.join("\r\n"), context, depth + 1));
        current =
          marker.endsWith("--") && marker !== `--${boundary}` ? null : [];
        if (marker === `--${boundary}--`) {
          closed = true;
          break;
        }
      } else if (current !== null) current.push(line);
    }
    if (!closed) {
      addWarning(
        context.warnings,
        "La estructura MIME está incompleta; revisa el texto.",
      );
      if (current !== null)
        parts.push(...mimeParts(current.join("\r\n"), context, depth + 1));
    }
    return parts;
  }
  if (type !== "text/plain" && type !== "text/html") return [];
  const transfer = (headers.get("content-transfer-encoding") || "8bit")
    .trim()
    .toLowerCase();
  let decoded;
  if (transfer === "base64") decoded = base64(body);
  else if (transfer === "quoted-printable") decoded = quotedPrintable(body);
  else if (["7bit", "8bit", "binary", ""].includes(transfer))
    decoded = bytes(body);
  else {
    addWarning(
      context.warnings,
      "Una codificación MIME no es compatible; captura los datos manualmente.",
    );
    return [];
  }
  return [
    {
      type,
      text: decodeBytes(
        decoded,
        parameter(contentType, "charset"),
        context.warnings,
      ),
    },
  ];
}

function htmlText(value) {
  const entities = {
    nbsp: " ",
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    dollar: "$",
  };
  return value
    .replace(/<!--[\s\S]*?(?:-->|$)/g, " ")
    .replace(
      /<(script|style|template|head|noscript|svg|math)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)/gi,
      " ",
    )
    .replace(/<[^>]*(?:>|$)/g, " ")
    .replace(
      /&(#x[\da-f]+|#\d+|nbsp|amp|lt|gt|quot|apos|dollar);/gi,
      (entity, name) => {
        if (name[0] !== "#") return entities[name.toLowerCase()] ?? entity;
        const code =
          name[1].toLowerCase() === "x"
            ? parseInt(name.slice(2), 16)
            : Number(name.slice(1));
        return code > 0 &&
          code <= 0x10ffff &&
          !(code >= 0xd800 && code <= 0xdfff)
          ? String.fromCodePoint(code)
          : " ";
      },
    );
}

function normalize(value) {
  return value
    .normalize("NFC")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function day(value) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function dateCandidate(value, now) {
  const clean = value.replace(/\([^)]*\)/g, " ").trim();
  const iso =
    /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/.exec(
      clean,
    );
  const rfc =
    /^(?:[a-z]{3},?\s+)?(\d{1,2})\s+([a-z]{3})\s+(\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?\s+(?:[+-]\d{4}|UT|UTC|GMT)$/i.exec(
      clean,
    );
  const months = [
    "jan",
    "feb",
    "mar",
    "apr",
    "may",
    "jun",
    "jul",
    "aug",
    "sep",
    "oct",
    "nov",
    "dec",
  ];
  const year = Number(iso?.[1] ?? rfc?.[3]);
  const month = iso
    ? Number(iso[2])
    : months.indexOf(rfc?.[2]?.toLowerCase()) + 1;
  const date = Number(iso?.[3] ?? rfc?.[1]);
  const hour = Number(iso?.[4] ?? rfc?.[4] ?? 0);
  const minute = Number(iso?.[5] ?? rfc?.[5] ?? 0);
  const second = Number(iso?.[6] ?? rfc?.[6] ?? 0);
  if (
    (!iso && !rfc) ||
    month < 1 ||
    month > 12 ||
    date < 1 ||
    date > new Date(Date.UTC(year, month, 0)).getUTCDate() ||
    hour > 23 ||
    minute > 59 ||
    second > 59
  )
    return null;
  const parsed = new Date(iso && !iso[4] ? `${clean}T12:00:00` : clean);
  return Number.isFinite(parsed.getTime()) && day(parsed) <= day(now)
    ? parsed.toISOString()
    : null;
}

function depositCandidate(subject, text, warnings) {
  const combined = `${subject} ${text}`;
  if (
    /(rechazad|pendiente|cancelad|fallid|devoluci[oó]n|promoci[oó]n|promotional|oferta|cashback|participa|gana\s+(?:hasta|un|dinero))/i.test(
      combined,
    )
  ) {
    addWarning(
      warnings,
      "El texto menciona un estado pendiente, rechazado o promocional; no se sugiere un depósito.",
    );
    return { recognized: false, amountCents: null };
  }
  const recognized =
    /(dep[oó]sito recibido|recibiste (?:un |una )?(?:dep[oó]sito|transferencia)|dinero recibido|transferencia recibida|monto recibido\s*:)/i.test(
      combined,
    );
  if (!recognized) {
    addWarning(
      warnings,
      "No se reconoció un aviso de depósito recibido; captura y verifica los datos manualmente.",
    );
    return { recognized: false, amountCents: null };
  }
  const matches = [
    ...text.matchAll(
      /\$\s*(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)\s*(?:MXN|pesos)\b/gi,
    ),
  ];
  const amounts = [
    ...new Set(
      matches.map((match) =>
        Math.round(Number(match[1].replaceAll(",", "")) * 100),
      ),
    ),
  ];
  if (amounts.length > 1) {
    addWarning(
      warnings,
      "Hay varios montos MXN diferentes; elige y captura el monto correcto.",
    );
    return { recognized: true, amountCents: null };
  }
  const amountCents = amounts[0];
  if (
    !Number.isSafeInteger(amountCents) ||
    amountCents <= 0 ||
    amountCents > 1e11
  ) {
    addWarning(
      warnings,
      "No se encontró un único monto MXN válido; captura el monto manualmente.",
    );
    return { recognized: true, amountCents: null };
  }
  return { recognized: true, amountCents };
}

async function inputBytes(input) {
  if (typeof input === "string") {
    if (input.length > MAX_EMAIL_BYTES)
      throw new Error("El correo supera el límite de 2 MiB.");
    const result = encoder.encode(input);
    if (result.byteLength > MAX_EMAIL_BYTES)
      throw new Error("El correo supera el límite de 2 MiB.");
    return result;
  }
  if (typeof Blob !== "undefined" && input instanceof Blob) {
    if (input.size > MAX_EMAIL_BYTES)
      throw new Error("El correo supera el límite de 2 MiB.");
    return new Uint8Array(await input.arrayBuffer());
  }
  const result = input instanceof ArrayBuffer ? new Uint8Array(input) : input;
  if (!(result instanceof Uint8Array))
    throw new Error("Elige un archivo .eml o pega texto de un correo.");
  if (result.byteLength > MAX_EMAIL_BYTES)
    throw new Error("El correo supera el límite de 2 MiB.");
  return result;
}

/** Read one local email. Every candidate needs human review before recording. */
export async function parseLocalEmail(
  input,
  { format = "eml", now = new Date() } = {},
) {
  if (!["eml", "text"].includes(format))
    throw new Error("Formato de correo no compatible.");
  const current = new Date(now);
  if (!Number.isFinite(current.getTime()))
    throw new Error("La fecha actual no es válida.");
  const raw = await inputBytes(input);
  if (!raw.length) throw new Error("El correo está vacío.");
  const warnings = [
    "Este archivo local no autentica al remitente. Verifica el monto, la fecha y la app antes de guardar.",
  ];
  let from = "",
    subject = "",
    date = "",
    messageId = "",
    text = "";
  if (format === "text") text = decodeBytes(raw, "utf-8", warnings);
  else {
    const source = binary(raw);
    const { headers } = readHeaders(source, warnings);
    const headerText = (key) => {
      const value = headers.get(key) || "";
      // Encoded words are ASCII; decode raw UTF-8 runs independently.
      return decodeHeader(
        value.replace(/[^\x00-\x7f]+/g, (part) =>
          decodeBytes(bytes(part), "utf-8", warnings),
        ),
        warnings,
      );
    };
    from = normalize(headerText("from")).slice(0, 320);
    subject = normalize(headerText("subject")).slice(0, 500);
    date = headers.get("date") || "";
    messageId = (headers.get("message-id") || "").trim();
    const parts = mimeParts(source, { parts: 0, warnings });
    const plain = parts.filter((part) => part.type === "text/plain");
    if (!plain.length && parts.length)
      addWarning(
        warnings,
        "Solo se encontró HTML; se convirtió a texto sin cargar imágenes ni enlaces.",
      );
    text = (plain.length ? plain : parts)
      .map((part) =>
        part.type === "text/html" ? htmlText(part.text) : part.text,
      )
      .join("\n");
    if (!parts.length)
      addWarning(
        warnings,
        "No se encontró texto legible; captura los datos manualmente.",
      );
  }
  text = normalize(text);
  const at = dateCandidate(date, current);
  if (!at)
    addWarning(
      warnings,
      "No hay una fecha válida del correo o es futura; elige la fecha real del depósito.",
    );
  const candidate = depositCandidate(subject, text, warnings);
  const unwrappedId =
    messageId.startsWith("<") && messageId.endsWith(">")
      ? messageId.slice(1, -1)
      : messageId;
  const validId = /^([^<>\s@]+)@([^<>\s@]+)$/.exec(unwrappedId);
  const identity = validId
    ? `message-id:${validId[1]}@${validId[2].toLowerCase()}`
    : // The identity cannot change when a future Date becomes today's Date.
      JSON.stringify({ from, subject, date: normalize(date), text });
  if (!validId)
    addWarning(
      warnings,
      "Sin Message-ID válido: se usa una huella del texto para detectar repeticiones.",
    );
  if (!globalThis.crypto?.subtle)
    throw new Error(
      "Tu navegador necesita un contexto seguro (HTTPS o localhost) para leer correos locales.",
    );
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    encoder.encode(identity),
  );
  const hash = [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
  return {
    id: `local-email:${hash}`,
    from,
    subject,
    at,
    ...candidate,
    preview: text.slice(0, MAX_PREVIEW),
    authenticated: false,
    requiresReview: true,
    warnings,
  };
}

export const parseEmail = parseLocalEmail;
