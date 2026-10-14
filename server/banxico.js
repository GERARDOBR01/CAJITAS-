export const SERIES = { SF43783: "TIIE 28 días", SF282: "CETES 28 días" };
export async function getRates({
  token = process.env.BANXICO_TOKEN,
  fetcher = fetch,
} = {}) {
  if (!token)
    throw Object.assign(
      new Error(
        "Configura el token de Banxico en el servidor para consultar tasas reales.",
      ),
      { status: 503 },
    );
  const response = await fetcher(
    "https://www.banxico.org.mx/SieAPIRest/service/v1/series/SF43783,SF282/datos/oportuno",
    {
      headers: { "Bmx-Token": token, Accept: "application/json" },
      signal: AbortSignal.timeout(10000),
    },
  );
  if (!response.ok)
    throw Object.assign(
      new Error("Banxico no pudo responder. Intenta más tarde."),
      { status: 502 },
    );
  const body = await response.json();
  const rates = Object.entries(SERIES).map(([id, label]) => {
    const series = body?.bmx?.series?.find((s) => s.idSerie === id);
    const data = series?.datos?.at(-1);
    const raw = String(data?.dato ?? "").trim();
    const rate = /^\d+(\.\d+)?$/.test(raw) ? Number(raw) : null;
    return {
      id,
      label,
      annualRate: rate,
      date: data?.fecha ?? null,
      available: rate !== null,
      title: series?.titulo ?? label,
    };
  });
  return {
    rates,
    consultedAt: new Date().toISOString(),
    source: "Banco de México · SIE",
  };
}
