import { describe, it, expect } from "vitest";
import {
  balance,
  initialData,
  reachedTarget,
  recordEntry,
} from "../src/domain.js";

const journalWith = (entries = [], targetCents = 100000) => ({
  ...initialData(),
  goals: [
    {
      id: "g1",
      name: "Viaje",
      provider: "Nu",
      icon: "star",
      targetCents,
      unlockDate: null,
      entries,
    },
  ],
});
const at = "2026-10-18T12:00:00.000Z";

describe("recordEntry", () => {
  it("adds a manual movement with its own id and leaves the input alone", () => {
    const data = journalWith();
    const { data: next } = recordEntry(data, "g1", { cents: 5000, at });
    expect(balance(next.goals[0])).toBe(5000);
    expect(next.goals[0].entries[0]).toMatchObject({
      cents: 5000,
      at,
      source: "manual",
    });
    expect(next.goals[0].entries[0].id).toEqual(expect.any(String));
    expect(data.goals[0].entries).toEqual([]);
  });

  it("keeps the id and source it is given", () => {
    const { data } = recordEntry(journalWith(), "g1", {
      cents: 2500,
      at,
      source: "guardian",
      id: "guardian-d1",
    });
    expect(data.goals[0].entries[0]).toMatchObject({
      id: "guardian-d1",
      source: "guardian",
    });
  });

  it("says when the movement completes the goal, and only then", () => {
    const data = journalWith([{ id: "a", cents: 90000, at, source: "manual" }]);
    expect(recordEntry(data, "g1", { cents: 5000, at }).reachedTarget).toBe(
      false,
    );
    expect(recordEntry(data, "g1", { cents: 10000, at }).reachedTarget).toBe(
      true,
    );
    const done = recordEntry(data, "g1", { cents: 10000, at }).data;
    expect(recordEntry(done, "g1", { cents: 100, at }).reachedTarget).toBe(
      false,
    );
  });

  it("never reports a withdrawal as reaching the goal", () => {
    const data = journalWith([{ id: "a", cents: 99000, at, source: "manual" }]);
    expect(recordEntry(data, "g1", { cents: -500, at }).reachedTarget).toBe(
      false,
    );
  });

  it("throws when the history would go below zero", () => {
    expect(() => recordEntry(journalWith(), "g1", { cents: -100, at })).toThrow(
      /saldo inválido/,
    );
  });

  it("throws on an unusable amount or a repeated id", () => {
    const data = journalWith([{ id: "a", cents: 100, at, source: "manual" }]);
    expect(() => recordEntry(data, "g1", { cents: 0, at })).toThrow(
      /movimiento inválido/,
    );
    expect(() => recordEntry(data, "g1", { cents: 100, at, id: "a" })).toThrow(
      /movimiento inválido/,
    );
    expect(() =>
      recordEntry(data, "g1", { cents: Number.MAX_SAFE_INTEGER, at }),
    ).toThrow();
  });

  it("throws for a goal that is not there", () => {
    expect(() =>
      recordEntry(journalWith(), "nope", { cents: 100, at }),
    ).toThrow(/Elige una cajita/);
  });
});

describe("reachedTarget", () => {
  it("compares two journals for one goal", () => {
    const before = journalWith([
      { id: "a", cents: 99000, at, source: "manual" },
    ]);
    const after = recordEntry(before, "g1", { cents: 1000, at }).data;
    expect(reachedTarget(before, after, "g1")).toBe(true);
    expect(reachedTarget(after, after, "g1")).toBe(false);
    expect(reachedTarget(before, after, "missing")).toBe(false);
  });
});
