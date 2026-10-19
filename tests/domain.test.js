import { describe, it, expect } from "vitest";
import {
  balance,
  plan,
  streak,
  initialData,
  validateBackup,
  cents,
  countdown,
  estimate,
  activityCSV,
  goalStatus,
  nextGoal,
  projection,
} from "../src/domain.js";
import { addReceipt } from "../src/receipts/gmail.js";
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
    ).toMatchObject(goal);
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

describe("metas sin fecha objetivo", () => {
  const open = { ...goal, id: "g2", name: "Colchoncito", unlockDate: null };
  it("el respaldo acepta metas sin fecha y las guarda como null", () => {
    for (const unlockDate of [null, undefined, ""]) {
      const restored = validateBackup({
        ...initialData(),
        goals: [{ ...open, unlockDate }],
      });
      expect(restored.goals[0].unlockDate).toBeNull();
    }
    // A malformed date is still rejected.
    for (const unlockDate of ["mañana", "2026-13-01", 20261101])
      expect(() =>
        validateBackup({ ...initialData(), goals: [{ ...open, unlockDate }] }),
      ).toThrow();
  });
  it("los respaldos viejos, siempre con fecha, siguen restaurando igual", () => {
    const v1 = {
      version: 1,
      goals: [goal],
      importedIds: [],
      assignments: {},
    };
    const restored = validateBackup(v1);
    expect(restored.goals[0].unlockDate).toBe("2026-11-01");
    expect(validateBackup(restored)).toEqual(restored);
  });
  it("sin fecha no hay plan, cuenta regresiva ni fecha vencida", () => {
    const now = new Date("2030-01-01T00:00:00").getTime();
    expect(plan(open, 7, now)).toBeNull();
    expect(countdown(null, now)).toBe("Sin fecha objetivo");
    expect(goalStatus(open, now)).toMatchObject({
      pastDue: false,
      remaining: 100000,
    });
  });
  it("el siguiente pasito prefiere la meta con fecha más cercana", () => {
    const later = { ...goal, id: "g3", unlockDate: "2027-01-01" };
    const data = { ...initialData(), goals: [open, later, goal] };
    expect(nextGoal(data).id).toBe("g1");
    expect(nextGoal({ ...initialData(), goals: [open] }).id).toBe("g2");
    const two = { ...open, id: "g4" };
    expect(nextGoal({ ...initialData(), goals: [open, two] }).id).toBe("g2");
  });
  it("el CSV incluye la fecha objetivo y la deja vacía si no hay", () => {
    const entry = { id: "e", cents: 100, at: "2026-10-01T12:00:00Z" };
    const csv = activityCSV({
      ...initialData(),
      goals: [
        { ...goal, entries: [entry] },
        { ...open, entries: [{ ...entry, id: "f" }] },
      ],
    });
    const [header, ...rows] = csv.replace("\ufeff", "").split("\r\n");
    expect(header.split(",").at(-1)).toBe("Fecha objetivo");
    expect(rows.map((row) => row.split(",").at(-1)).sort()).toEqual([
      '""',
      '"2026-11-01"',
    ]);
  });
});

describe("projection", () => {
  const DAY = 86400000,
    now = Date.parse("2026-10-19T12:00:00");
  const goal = (entries, targetCents = 100000) => ({
    id: "g",
    name: "Viaje",
    targetCents,
    entries: entries.map(([daysAgo, cents], i) => ({
      id: `e${i}`,
      cents,
      at: new Date(now - daysAgo * DAY).toISOString(),
      source: "manual",
    })),
  });
  it("sin movimientos no inventa una fecha", () => {
    expect(projection(goal([]), now)).toEqual({ kind: "none" });
  });
  it("una meta cumplida ya no se proyecta", () => {
    expect(projection(goal([[5, 100000]]), now)).toEqual({ kind: "done" });
  });
  it("estima con el ritmo de los últimos días", () => {
    // $200 en 20 días = $10 al día; faltan $800 → 80 días.
    const result = projection(goal([[20, 20000]]), now);
    expect(result).toMatchObject({ kind: "pace", days: 80 });
    expect(result.date).toBe("2027-01-07");
  });
  it("los retiros bajan el ritmo y, si lo anulan, no hay estimación", () => {
    expect(
      projection(
        goal([
          [20, 20000],
          [3, -20000],
        ]),
        now,
      ),
    ).toEqual({
      kind: "none",
    });
  });
  it("no promete fechas a más de diez años", () => {
    expect(projection(goal([[20, 100]], 100000000), now)).toEqual({
      kind: "none",
    });
  });
});
