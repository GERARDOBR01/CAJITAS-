import { describe, it, expect } from "vitest";
import { initialData } from "../src/domain.js";
import {
  dueSurprises,
  goalSummary,
  sameSpecial,
  specialFromGift,
  waitingRewards,
} from "../src/cloud/surprises.js";
import { makeCode, normalizeCode, pairIdOf } from "../src/cloud/partner.js";

const goal = (cents) => ({
  id: "g1",
  name: "Viaje",
  provider: "Nu",
  icon: "star",
  targetCents: 100000,
  unlockDate: "",
  entries: cents
    ? [{ id: "e1", cents, at: "2026-10-18T12:00:00.000Z", source: "manual" }]
    : [],
});
const data = (cents = 0) => ({ ...initialData(), goals: [goal(cents)] });
const gift = (extra) => ({
  id: extra.id ?? extra.kind,
  from: "g",
  to: "j",
  fromName: "Gerardo",
  createdAt: 1,
  ...extra,
});

describe("lo que ve la pareja", () => {
  it("nombre y avance, sin movimientos", () => {
    expect(goalSummary(data(25000))).toEqual([
      {
        id: "g1",
        name: "Viaje",
        targetCents: 100000,
        savedCents: 25000,
        unlockDate: "",
      },
    ]);
  });
});

describe("cuándo se abre cada sorpresa", () => {
  const base = { uid: "j", now: new Date("2026-10-18T12:00:00") };
  it("una notita al abrir sale de inmediato; la de la fecha, ese día", () => {
    const gifts = [
      gift({ id: "a", kind: "note", showOn: "open", text: "Hola" }),
      gift({ id: "b", kind: "note", showOn: "date", date: "2026-10-18" }),
      gift({ id: "c", kind: "note", showOn: "date", date: "2026-12-24" }),
    ];
    expect(
      dueSurprises({ ...base, gifts, data: data() }).map((g) => g.id),
    ).toEqual(["a", "b"]);
  });
  it("la de «cuando ahorre» espera al siguiente ahorro", () => {
    const gifts = [gift({ kind: "note", showOn: "save" })];
    expect(dueSurprises({ ...base, gifts, data: data() })).toHaveLength(0);
    expect(
      dueSurprises({ ...base, gifts, data: data(), saved: 1 }),
    ).toHaveLength(1);
  });
  it("un premio se abre al llegar al porcentaje y antes solo se insinúa", () => {
    const gifts = [gift({ kind: "reward", goalId: "g1", threshold: 50 })];
    expect(dueSurprises({ ...base, gifts, data: data(49000) })).toHaveLength(0);
    expect(waitingRewards({ ...base, gifts, data: data(49000) })).toHaveLength(
      1,
    );
    expect(dueSurprises({ ...base, gifts, data: data(50000) })).toHaveLength(1);
    expect(waitingRewards({ ...base, gifts, data: data(50000) })).toHaveLength(
      0,
    );
  });
  it("lo ya abierto o lo que mandé yo no vuelve a salir", () => {
    const gifts = [
      gift({ kind: "note", showOn: "open", openedAt: 5 }),
      gift({ id: "mine", kind: "note", showOn: "open", from: "j", to: "g" }),
    ];
    expect(dueSurprises({ ...base, gifts, data: data() })).toHaveLength(0);
  });
});

describe("Cookie de regalo", () => {
  it("guarda las palabras de quien la manda", () => {
    const special = specialFromGift(
      gift({ kind: "pet", lines: ["¡Muack!"], loveText: "¡Te quiero!" }),
    );
    expect(special).toEqual({
      from: "Gerardo",
      lines: ["¡Muack!"],
      loveText: "¡Te quiero!",
      motto: "",
      pets: ["cat"],
    });
    expect(sameSpecial(special, { ...special })).toBe(true);
    expect(sameSpecial(special, { ...special, loveText: "otra" })).toBe(false);
  });
});

describe("códigos de pareja", () => {
  it("6 caracteres sin letras confusas", () => {
    for (let i = 0; i < 50; i++)
      expect(makeCode()).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    expect(normalizeCode(" abc-234x ")).toBe("ABC234");
    expect(pairIdOf("z", "a")).toBe("a_z");
  });
});
