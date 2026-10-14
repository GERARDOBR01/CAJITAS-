import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { mkdir, readFile, writeFile, unlink, rename } from "node:fs/promises";
import path from "node:path";
function key() {
  if ((process.env.SESSION_SECRET ?? "").length < 32)
    throw Object.assign(
      new Error(
        "Configura SESSION_SECRET (32 caracteres o más) en el servidor.",
      ),
      { status: 503 },
    );
  return createHash("sha256").update(process.env.SESSION_SECRET).digest();
}
function seal(value) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString(
    "base64url",
  );
}
function open(value) {
  const buf = Buffer.from(value, "base64url"),
    cipher = createDecipheriv("aes-256-gcm", key(), buf.subarray(0, 12));
  cipher.setAuthTag(buf.subarray(12, 28));
  return JSON.parse(
    Buffer.concat([cipher.update(buf.subarray(28)), cipher.final()]).toString(
      "utf8",
    ),
  );
}
async function redis(command) {
  const response = await fetch(process.env.UPSTASH_REDIS_REST_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok)
    throw Object.assign(
      new Error("El almacén de sesiones no está disponible."),
      { status: 503 },
    );
  const body = await response.json();
  if (body.error)
    throw Object.assign(
      new Error("El almacén de sesiones no está disponible."),
      { status: 503 },
    );
  return body.result;
}
function useRedis() {
  if (
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN
  )
    return true;
  if (process.env.NODE_ENV === "production" || process.env.VERCEL)
    throw Object.assign(
      new Error("Configura Redis REST para las sesiones en producción."),
      { status: 503 },
    );
  return false;
}
function file(id) {
  if (!/^[a-z0-9:-]+$/i.test(id)) throw new Error("ID inválido.");
  return path.resolve(".local", id.replaceAll(":", "-") + ".json");
}
export async function setRecord(id, value, ttl = 2592000) {
  const data = seal({ value, expires: Date.now() + ttl * 1000 });
  if (useRedis()) return redis(["SET", `cajitas:${id}`, data, "EX", ttl]);
  await mkdir(".local", { recursive: true, mode: 0o700 });
  await writeFile(file(id), data, { mode: 0o600 });
}
export async function getRecord(id) {
  let data;
  if (useRedis()) data = await redis(["GET", `cajitas:${id}`]);
  else {
    try {
      data = await readFile(file(id), "utf8");
    } catch (error) {
      if (error.code === "ENOENT") return null;
      throw error;
    }
  }
  if (!data) return null;
  const record = open(data);
  return record.expires > Date.now() ? record.value : null;
}
export async function deleteRecord(id) {
  if (useRedis()) return redis(["DEL", `cajitas:${id}`]);
  await unlink(file(id)).catch((e) => {
    if (e.code !== "ENOENT") throw e;
  });
}
export async function takeRecord(id) {
  if (useRedis()) {
    const data = await redis(["GETDEL", `cajitas:${id}`]);
    if (!data) return null;
    const record = open(data);
    return record.expires > Date.now() ? record.value : null;
  }
  // Atomic rename consumes the transaction even with simultaneous callbacks locally.
  const consumed = file(id) + ".consumed-" + randomBytes(8).toString("hex");
  try {
    await rename(file(id), consumed);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
  try {
    const record = open(await readFile(consumed, "utf8"));
    return record.expires > Date.now() ? record.value : null;
  } finally {
    await unlink(consumed);
  }
}
let lastNonce = 0;
export async function nextNonce() {
  // Shared atomic counter in serverless; monotonic microsecond-sized number locally.
  const base = Date.now() * 1000;
  if (useRedis())
    return String(
      await redis([
        "EVAL",
        "local n=tonumber(redis.call('GET',KEYS[1]) or '0'); local b=tonumber(ARGV[1]); n=math.max(n+1,b); redis.call('SET',KEYS[1],string.format('%.0f',n)); return string.format('%.0f',n)",
        1,
        "cajitas:bitso-nonce",
        String(base),
      ]),
    );
  lastNonce = Math.max(lastNonce + 1, base);
  return String(lastNonce);
}
export async function loginAttempt(id) {
  if (useRedis()) {
    const count = await redis([
      "EVAL",
      "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],900) end; return n",
      1,
      `cajitas:attempt:${id}`,
    ]);
    return Number(count) <= 5;
  }
  const record = (await getRecord(`attempt:${id}`)) ?? {
    count: 0,
    expires: Date.now() + 900000,
  };
  if (record.expires < Date.now()) {
    record.count = 0;
    record.expires = Date.now() + 900000;
  }
  record.count++;
  await setRecord(`attempt:${id}`, record, 900);
  return record.count <= 5;
}
