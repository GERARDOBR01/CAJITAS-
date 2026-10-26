import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
// Partner builds its invite link from the page address.
vi.hoisted(() => {
  globalThis.location ??= { origin: "https://guardadito.test", search: "" };
});
import { pairExtras } from "../src/cloud/usePartner.js";
import Partner from "../src/components/Partner.jsx";

const partner = (extras) => ({
  pair: { id: "p", members: ["a", "b"], names: { a: "Ana", b: "Beto" } },
  partnerUid: "b",
  partnerName: "Beto",
  summary: [{ id: "g", name: "Viaje", savedCents: 500, targetCents: 1000 }],
  sent: [],
  received: [],
  waiting: [],
  pending: {},
  held: 0,
  toConfirm: [],
  myDeposits: [],
  guardian: null,
  myPayout: null,
  extras,
});
const render = (extras) =>
  renderToStaticMarkup(
    createElement(Partner, {
      cloud: { user: { uid: "a" } },
      partner: partner(extras),
      notify: () => {},
      onNavigate: () => {},
    }),
  );

describe("la pantalla de pareja", () => {
  it("sin extras: cómo va la pareja, sin Cookie, notitas, premios ni CLABE", () => {
    const html = render(false);
    expect(html).toContain("Cómo va Beto");
    expect(html).toContain("cajitas de los dos");
    for (const hidden of ["Cookie", "Notitas", "Premios", "CLABE"])
      expect(html).not.toContain(hidden);
  });
  it("con extras conserva todo", () => {
    const html = render(true);
    expect(html).toContain("Cookie");
    expect(html).toContain("Notitas");
  });
});

describe("pareja sencilla", () => {
  it("una pareja nueva solo ve lo básico: cajitas de los dos y cómo va cada quien", () => {
    expect(pairExtras({})).toBe(false);
  });
  it("una pareja que ya usa el guardián o las sorpresas los conserva", () => {
    expect(pairExtras({ guardian: { clabe: "x" } })).toBe(true);
    expect(pairExtras({ myPayout: { clabe: "x" } })).toBe(true);
    expect(pairExtras({ sent: [{ kind: "note" }] })).toBe(true);
    expect(pairExtras({ received: [{ kind: "pet" }] })).toBe(true);
    // Cookie already given lives in the preferences.
    expect(pairExtras({ special: { from: "Gerardo" } })).toBe(true);
  });
  it("las herramientas del dueño siempre los muestran", () => {
    expect(pairExtras({ ownerTools: true })).toBe(true);
  });
});
