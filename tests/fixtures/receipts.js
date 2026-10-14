// SYNTHETIC examples only. Not real receipts or verified sender addresses.
export const fixtureSenders = {
  Nu: ["depositos@nu.example.invalid"],
  "Mercado Pago": ["avisos@mp.example.invalid"],
};
export function receipt({
  id = "sample-nu-1",
  provider = "Nu",
  subject = "Depósito recibido",
  text = "Recibiste $1,250.50 MXN. Referencia: DEMO-001.",
  html = false,
  from,
  authenticated = true,
} = {}) {
  const address = from ?? fixtureSenders[provider][0];
  return {
    id,
    internalDate: String(new Date("2026-09-01T18:30:00Z").getTime()),
    payload: {
      mimeType: html ? "text/html" : "text/plain",
      headers: [
        { name: "From", value: `Comprobantes <${address}>` },
        { name: "Subject", value: subject },
        {
          name: "Authentication-Results",
          value: authenticated
            ? `mx.google.com; dkim=pass header.i=@${address.split("@")[1]}; spf=pass`
            : "mx.google.com; dkim=fail",
        },
      ],
      body: { data: Buffer.from(text).toString("base64url") },
    },
  };
}
export const nuExample = receipt();
export const mpExample = receipt({
  id: "sample-mp-1",
  provider: "Mercado Pago",
  subject: "Dinero recibido",
  html: true,
  text: "<h1>Dinero recibido</h1><p>Monto: $800.00 pesos</p>",
});
