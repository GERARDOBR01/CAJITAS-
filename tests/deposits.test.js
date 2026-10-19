import { describe, expect, it } from "vitest";
import {
  applyConfirmed,
  checkDeposit,
  cleanClabe,
  concept,
  formatClabe,
  guardianEntryId,
  pendingByGoal,
  validClabe,
} from "../src/cloud/deposits.js";
import {
  activityCSV,
  initialData,
  removeManualEntry,
  validateBackup,
} from "../src/domain.js";

const J = "jade",
  G = "gerardo";
const goal = (entries = []) => ({
  id: "viaje",
  name: "Viaje",
  targetCents: 100000,
  unlockDate: null,
  provider: "Mercado Pago",
  icon: "star",
  frequency: 7,
  archived: false,
  entries,
});
const journal = (entries) => ({ ...initialData(), goals: [goal(entries)] });
const deposit = (extra = {}) => ({
  id: "d1",
  from: J,
  to: G,
  goalId: "viaje",
  goalName: "Viaje",
  cents: 20000,
  method: "spei",
  status: "confirmed",
  createdAt: Date.parse("2026-10-10T12:00:00Z"),
  decidedAt: Date.parse("2026-10-11T12:00:00Z"),
  ...extra,
});

describe("CLABE", () => {
  it("checks the 18 digits and the check digit", () => {
    expect(validClabe("002010077777777771")).toBe(true);
    expect(validClabe("002 010 07777777777 1")).toBe(true);
    expect(validClabe("002010077777777772")).toBe(false);
    expect(validClabe("00201007777777777")).toBe(false);
    expect(validClabe("")).toBe(false);
  });
  it("prints it the way banks do", () => {
    expect(cleanClabe("002-010 0777")).toBe("0020100777");
    expect(formatClabe("002010077777777771")).toBe("002 010 07777777777 1");
  });
  it("makes a concept banks accept", () => {
    expect(concept("Viaje a Cancún 🏖️!")).toBe("Guardadito Viaje a Cancun");
    expect(concept("x".repeat(80))).toHaveLength(40);
  });
});

describe("deposits on their way", () => {
  it("adds up what is pending per cajita, only mine", () => {
    const list = [
      deposit({ status: "pending" }),
      deposit({ id: "d2", status: "pending", cents: -5000 }),
      deposit({ id: "d3", status: "pending", from: G, to: J }),
      deposit({ id: "d4" }),
    ];
    const pending = pendingByGoal(list, J);
    expect(pending.viaje.in).toBe(20000);
    expect(pending.viaje.out).toBe(5000);
    expect(pending.viaje.items).toHaveLength(2);
  });
  it("never asks back more than the cajita has", () => {
    const g = goal([{ id: "a", cents: 10000, at: "2026-10-01T12:00:00.000Z" }]);
    expect(checkDeposit(g, 5000)).toBe(5000);
    expect(checkDeposit(g, -10000)).toBe(-10000);
    expect(() => checkDeposit(g, -10001)).toThrow(/más de lo que tienes/);
    expect(() => checkDeposit(g, -6000, 5000)).toThrow(/más de lo que tienes/);
    expect(() => checkDeposit(g, 0)).toThrow();
  });
});

describe("a confirmed deposit becomes a movement", () => {
  it("records it once, with the guardian as origin", () => {
    const now = Date.parse("2026-10-18T12:00:00Z");
    const { data, marks, added } = applyConfirmed(
      journal([]),
      [deposit()],
      J,
      now,
    );
    expect(added).toHaveLength(1);
    expect(marks).toHaveLength(1);
    expect(data.goals[0].entries).toEqual([
      {
        id: guardianEntryId("d1"),
        cents: 20000,
        at: "2026-10-11T12:00:00.000Z",
        source: "guardian",
      },
    ]);
    // A second device (or a retry) only marks it.
    const again = applyConfirmed(data, [deposit()], J, now);
    expect(again.data).toBe(data);
    expect(again.added).toHaveLength(0);
    expect(again.marks).toHaveLength(1);
  });
  it("ignores pending, rejected, applied and other people's deposits", () => {
    const list = [
      deposit({ id: "p", status: "pending" }),
      deposit({ id: "r", status: "rejected" }),
      deposit({ id: "a", appliedAt: 1 }),
      deposit({ id: "o", from: G, to: J }),
      deposit({ id: "m", goalId: "no-existe" }),
    ];
    const result = applyConfirmed(journal([]), list, J);
    expect(result.marks).toHaveLength(0);
    expect(result.data.goals[0].entries).toHaveLength(0);
  });
  it("never dates a movement in the future", () => {
    const now = Date.parse("2026-10-18T12:00:00Z");
    const { data } = applyConfirmed(
      journal([]),
      [deposit({ decidedAt: now + 60000 })],
      J,
      now,
    );
    expect(data.goals[0].entries[0].at).toBe(new Date(now).toISOString());
  });
  it("skips a withdrawal the cajita can no longer cover", () => {
    const result = applyConfirmed(journal([]), [deposit({ cents: -5000 })], J);
    expect(result.added).toHaveLength(0);
    expect(result.marks).toHaveLength(0);
  });
  it("keeps the origin through backups and cannot be edited by hand", () => {
    const { data } = applyConfirmed(journal([]), [deposit()], J);
    const restored = validateBackup(JSON.parse(JSON.stringify(data)));
    expect(restored.goals[0].entries[0].source).toBe("guardian");
    expect(activityCSV(restored)).toContain('"Confirmado"');
    expect(() =>
      removeManualEntry(restored, "viaje", guardianEntryId("d1")),
    ).toThrow(/manuales/);
  });
});
