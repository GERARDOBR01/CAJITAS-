import { describe, it, expect } from "vitest";
import { parseDeposit, senderAddress, PATTERNS } from "../server/parser.js";
import {
  receipt,
  fixtureSenders,
  nuExample,
  mpExample,
} from "./fixtures/receipts.js";
const parse = (m) => parseDeposit(m, { senders: fixtureSenders });
describe("parser conservador de comprobantes sintéticos", () => {
  it("extrae centavos de Nu y MXN de Mercado Pago sin datos personales", () => {
    expect(parse(nuExample)).toMatchObject({
      provider: "Nu",
      amountCents: 125050,
      validated: false,
    });
    expect(parse(mpExample)).toMatchObject({
      provider: "Mercado Pago",
      amountCents: 80000,
      validated: false,
    });
    expect(Object.keys(parse(nuExample)).sort()).toEqual(
      ["id", "provider", "patternId", "validated", "amountCents", "at"].sort(),
    );
  });
  it("mantiene el ID estable para deduplicar", () =>
    expect(parse(nuExample).id).toBe(parse(nuExample).id));
  it("rechaza remitentes parecidos, reenviados y firmas fallidas", () => {
    expect(
      parse(receipt({ from: "depositos@nu.example.invalid.evil.com" })),
    ).toBeNull();
    expect(parse(receipt({ authenticated: false }))).toBeNull();
    expect(parse(receipt({ subject: "Fwd: comprobante" }))).toBeNull();
    expect(
      senderAddress("Nu <depositos@nu.example.invalid> attacker@example.com"),
    ).toBeNull();
  });
  it("rechaza pendientes, retiros, promociones, moneda desconocida y montos ambiguos", () => {
    for (const options of [
      { text: "Depósito pendiente. Recibiste $100 MXN." },
      { subject: "Retiro exitoso" },
      { subject: "Gana dinero con Nu" },
      { text: "Recibiste $500 USD." },
      { text: "Recibiste $500 MXN. Monto: $600 MXN." },
      { text: "Recibiste $0 MXN." },
    ])
      expect(parse(receipt(options))).toBeNull();
  });
  it("prioriza texto plano sobre HTML para no duplicar montos MIME", () => {
    const m = receipt();
    m.payload = {
      ...m.payload,
      mimeType: "multipart/alternative",
      body: undefined,
      parts: [nuExample.payload, mpExample.payload],
    };
    expect(parse(m)?.amountCents).toBe(125050);
  });
  it("marca todos los patrones pendientes de validar", () =>
    expect(PATTERNS.every((p) => !p.validated)).toBe(true));
});
