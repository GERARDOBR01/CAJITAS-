import { describe, it, expect } from "vitest";
import {
  balance,
  plan,
  streak,
  initialData,
  addReceipt,
  validateBackup,
  cents,
  countdown,
  estimate,
} from "../src/domain.js";
const goal = {
  id: "g1",
  name: "Viaje",
  provider: "Nu",
  icon: "star",
  targetCents: 100000,
  unlockDate: "2026-11-01",
  entries: [],
};
describe("registro de ahorro y recuperación", () => {
  it("mantiene centavos y no permite redondear montos ambiguos", () => {
    expect(cents("0.29")).toBe(29);
    for (const value of ["0", "-1", "1.234", "1e3", "NaN"])
      expect(() => cents(value)).toThrow();
  });
  it("deduplica correo y mantiene registro independiente del saldo externo", () => {
    const initial = { ...initialData(), goals: [goal] },
      receipt = {
        id: "email1",
        amountCents: 50000,
        at: "2026-10-01T18:00:00Z",
      };
    const added = addReceipt(initial, receipt, "g1");
    expect(balance(added.goals[0])).toBe(50000);
    expect(addReceipt(added, receipt, "g1")).toBe(added);
  });
  it("rechaza respaldo con retiros mayores al ahorro y fechas inexistentes", () => {
    expect(() =>
      validateBackup({
        ...initialData(),
        goals: [
          {
            ...goal,
            entries: [{ id: "w", cents: -1, at: "2026-10-01T18:00:00Z" }],
          },
        ],
      }),
    ).toThrow();
    expect(() =>
      validateBackup({
        ...initialData(),
        goals: [{ ...goal, unlockDate: "2026-02-30" }],
      }),
    ).toThrow();
    expect(
      validateBackup({ ...initialData(), goals: [goal] }).goals[0],
    ).toEqual(goal);
  });
  it("calcula el ahorro restante por periodos y desbloquea a medianoche local", () => {
    expect(plan(goal, 7, new Date("2026-10-18T00:00:00").getTime())).toBe(
      50000,
    );
    expect(
      countdown("2026-11-01", new Date("2026-11-01T00:00:00").getTime()),
    ).toBe("¡Compromiso cumplido!");
    expect(estimate(100000, 10, 365)).toBe(10000);
  });
  it("cuenta racha por días locales únicos y permite el día actual sin depósito", () => {
    const entries = [
      "2026-10-12T12:00:00",
      "2026-10-13T12:00:00",
      "2026-10-13T15:00:00",
    ].map((at, i) => ({ id: String(i), at, cents: 100 }));
    expect(
      streak([{ ...goal, entries }], new Date("2026-10-14T12:00:00")),
    ).toBe(2);
  });
});
