import { createHmac } from "node:crypto";
export function bitsoAuthorization(
  key,
  secret,
  nonce,
  path = "/api/v3/balance/",
) {
  const signature = createHmac("sha256", secret)
    .update(`${nonce}GET${path}`)
    .digest("hex");
  return `Bitso ${key}:${nonce}:${signature}`;
}
export async function getBitsoBalance({
  key = process.env.BITSO_API_KEY,
  secret = process.env.BITSO_API_SECRET,
  nonce,
  fetcher = fetch,
} = {}) {
  if (!key || !secret)
    throw Object.assign(
      new Error("Bitso aún no está configurado en el servidor."),
      { status: 503 },
    );
  const path = "/api/v3/balance/";
  const response = await fetcher(`https://bitso.com${path}`, {
    headers: { Authorization: bitsoAuthorization(key, secret, nonce, path) },
    signal: AbortSignal.timeout(10000),
    redirect: "error",
  });
  if (!response.ok)
    throw Object.assign(
      new Error(
        "No se pudo consultar Bitso. Revisa la llave y su permiso Ver balances.",
      ),
      { status: 502 },
    );
  const body = await response.json();
  if (!body.success || !Array.isArray(body.payload?.balances))
    throw Object.assign(new Error("Bitso devolvió una respuesta inválida."), {
      status: 502,
    });
  return {
    balances: body.payload.balances.map((b) => ({
      currency: b.currency,
      total: b.total,
      available: b.available,
      locked: b.locked,
    })),
    consultedAt: new Date().toISOString(),
  };
}
