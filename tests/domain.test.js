import { describe, it, expect } from "vitest";
import {
  balance,
  plan,
  savedWeeks,
  initialData,
  validateBackup,
  cents,
  dateText,
  estimate,
  activityCSV,
  goalSummary,
  isComplete,
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
    const day = (d) => new Date(`${d}T09:00:00`).getTime();
    expect(dateText("2026-11-01", day("2026-11-01"))).toBe("Hoy es el día");
    expect(dateText("2026-11-01", day("2026-10-31"))).toBe("Mañana es el día");
    expect(dateText("2026-11-01", day("2026-10-20"))).toBe("Faltan 12 días");
    expect(dateText("2026-11-01", day("2026-11-03"))).toBe("Su fecha ya pasó");
    // Nothing that ticks by the second.
    expect(dateText("2026-11-01", day("2026-10-20"))).not.toMatch(/\d:\d\d/);
    expect(estimate(100000, 10, 365)).toBe(10000);
  });
  it("cuenta semanas con ahorro, y una semana sin ahorrar no quita nada", () => {
    const entries = [
      "2026-10-05T12:00:00", // lunes
      "2026-10-11T20:00:00", // domingo de la misma semana
      "2026-10-26T12:00:00", // dos semanas después
    ].map((at, i) => ({ id: String(i), at, cents: 100 }));
    expect(savedWeeks([{ ...goal, entries }])).toBe(2);
    const withdrawal = { id: "w", at: "2026-10-14T12:00:00", cents: -50 };
    expect(savedWeeks([{ ...goal, entries: [...entries, withdrawal] }])).toBe(
      2,
    );
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
    expect(dateText(null, now)).toBe("Sin prisa");
    expect(goalSummary(open, now)).toMatchObject({
      pastDue: false,
      remaining: 100000,
    });
  });
  it("el resumen solo dice 100 % cuando la cajita está cumplida", () => {
    const now = new Date("2026-01-01T00:00:00").getTime();
    const at = "2025-12-01T12:00:00.000Z";
    const almost = { ...goal, entries: [{ id: "a", cents: 99600, at }] };
    expect(goalSummary(almost, now)).toMatchObject({
      saved: 99600,
      percent: 99,
      remaining: 400,
      complete: false,
    });
    const done = { ...goal, entries: [{ id: "a", cents: 120000, at }] };
    expect(goalSummary(done, now)).toMatchObject({
      progress: 1,
      percent: 100,
      remaining: 0,
      complete: true,
      pastDue: false,
    });
    expect(isComplete(done)).toBe(true);
    expect(isComplete(almost)).toBe(false);
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
