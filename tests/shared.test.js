import { describe, it, expect } from "vitest";
import {
  checkEntry,
  contributions,
  myPart,
  myPlan,
  splitFor,
  withEntries,
} from "../src/cloud/shared.js";

const goal = withEntries(
  [
    {
      id: "viaje",
      name: "Viaje",
      targetCents: 2000000,
      unlockDate: "",
      split: { a: 60, j: 40 },
      createdAt: 1,
    },
  ],
  [
    { id: "2", goalId: "viaje", by: "j", cents: 30000, at: "2026-10-10" },
    { id: "1", goalId: "viaje", by: "a", cents: 50000, at: "2026-10-01" },
    { id: "3", goalId: "otra", by: "a", cents: 99, at: "2026-10-01" },
  ],
)[0];

describe("cajita en pareja", () => {
  it("junta los aportes de su cajita en orden", () => {
    expect(goal.entries.map((e) => e.id)).toEqual(["1", "2"]);
    expect(contributions(goal)).toEqual({ a: 50000, j: 30000 });
  });
  it("cada quien ve su parte y lo que le falta, sin comparar", () => {
    expect(myPart(goal, "j")).toEqual({
      percent: 40,
      share: 800000,
      mine: 30000,
      remaining: 770000,
    });
    expect(myPart(goal, "a").remaining).toBe(1150000);
  });
  it("sin fecha no hay plan; con fecha, se reparte lo que te falta", () => {
    expect(myPlan(goal, "j", 15, Date.now(), 5)).toBeNull();
    const dated = { ...goal, unlockDate: "2099-01-01" };
    expect(myPlan(dated, "j", 15, Date.now(), 5)).toBeGreaterThan(0);
  });
  it("solo se retira lo que uno apartó", () => {
    expect(checkEntry(goal, "j", -30000)).toBe(-30000);
    expect(() => checkEntry(goal, "j", -30001)).toThrow(/tú apartaste/);
    expect(() => checkEntry(goal, "j", 0)).toThrow();
  });
  it("el reparto suma 100", () => {
    expect(splitFor("a", "j", 60)).toEqual({ a: 60, j: 40 });
    expect(splitFor("a", "j", 150)).toEqual({ a: 100, j: 0 });
  });
});
