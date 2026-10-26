import { describe, it, expect } from "vitest";
import { initialData, recordEntry } from "../src/domain.js";
import {
  FIRST_SAVING,
  GOAL_REACHED,
  savingResponse,
} from "../src/feedback/response.js";
import { WITHDRAWAL_NOTE } from "../src/pet/state.js";

const goal = (id, entries = [], targetCents = 100000) => ({
  id,
  name: id,
  provider: "Nu",
  icon: "star",
  targetCents,
  unlockDate: null,
  entries,
});
const at = "2026-10-18T12:00:00.000Z";
const journal = (...goals) => ({ ...initialData(), goals });
const add = (data, goalId, cents) =>
  recordEntry(data, goalId, { cents, at }).data;

describe("savingResponse", () => {
  it("cheers a deposit and counts it as saving", () => {
    const before = journal(goal("g1", [{ id: "a", cents: 1000, at }]));
    expect(savingResponse(before, add(before, "g1", 15000))).toEqual({
      kind: "cheer",
      saved: true,
      message: "Ahorro registrado. ¡Un pasito más!",
    });
  });

  it("the very first saving gets its own words", () => {
    const before = journal(goal("g1"));
    expect(savingResponse(before, add(before, "g1", 15000)).message).toBe(
      FIRST_SAVING,
    );
  });

  it("a small saving is celebrated for counting, not measured", () => {
    const before = journal(goal("g1", [{ id: "a", cents: 1000, at }]));
    expect(savingResponse(before, add(before, "g1", 2000)).message).toBe(
      "$20 también cuentan. ¡Así se hace!",
    );
  });

  it("crossing a quarter, half or three quarters is named", () => {
    const before = journal(goal("g1", [{ id: "a", cents: 40000, at }]));
    expect(savingResponse(before, add(before, "g1", 15000)).message).toBe(
      "¡Ya vas a la mitad de g1!",
    );
    const third = journal(goal("g1", [{ id: "a", cents: 70000, at }]));
    expect(savingResponse(third, add(third, "g1", 6000)).message).toContain(
      "Tres cuartas partes",
    );
  });

  it("celebrates the deposit that reaches the target, with the caller's sentence first", () => {
    const before = journal(goal("g1", [{ id: "a", cents: 90000, at }]));
    const after = add(before, "g1", 10000);
    expect(savingResponse(before, after)).toMatchObject({
      kind: "celebrate",
      saved: true,
      message: GOAL_REACHED,
    });
    expect(
      savingResponse(before, after, "Depósito registrado una sola vez.")
        .message,
    ).toBe(`Depósito registrado una sola vez. ${GOAL_REACHED}`);
  });

  it("celebrates once for a batch where any deposit completes a cajita", () => {
    const before = journal(
      goal("g1"),
      goal("g2", [{ id: "a", cents: 90000, at }]),
    );
    const after = add(add(before, "g1", 500), "g2", 20000);
    expect(savingResponse(before, after, "Consulta lista.")).toMatchObject({
      kind: "celebrate",
      saved: true,
      message: `Consulta lista. ${GOAL_REACHED}`,
    });
  });

  it("does not celebrate a cajita that was already complete", () => {
    const before = journal(goal("g1", [{ id: "a", cents: 100000, at }]));
    expect(savingResponse(before, add(before, "g1", 100)).kind).toBe("cheer");
  });

  it("notes a withdrawal and does not count it as saving", () => {
    const before = journal(goal("g1", [{ id: "a", cents: 5000, at }]));
    expect(savingResponse(before, add(before, "g1", -1000))).toEqual({
      kind: "withdrawal",
      saved: false,
      message: WITHDRAWAL_NOTE,
    });
  });

  it("celebrates an edit that completes a cajita, but it is not saving", () => {
    const before = journal(goal("g1", [{ id: "a", cents: 50000, at }]));
    const after = journal(goal("g1", [{ id: "a", cents: 50000, at }], 50000));
    expect(savingResponse(before, after, "Tu plan se ajustó.")).toEqual({
      kind: "celebrate",
      saved: false,
      message: `Tu plan se ajustó. ${GOAL_REACHED}`,
    });
  });

  it("only passes the caller's sentence on when no money moved", () => {
    const before = journal(goal("g1"));
    expect(savingResponse(before, before, "Correo vinculado.")).toEqual({
      kind: "plain",
      saved: false,
      message: "Correo vinculado.",
    });
  });
});
