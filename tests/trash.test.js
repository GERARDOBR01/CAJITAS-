import { describe, expect, it } from "vitest";
import {
  initialData,
  removeManualEntry,
  restoreEntry,
  trashItems,
  validateBackup,
} from "../src/domain.js";

const DAY = 86400000;
const NOW = Date.parse("2026-10-18T12:00:00Z");
const journal = (entries) => ({
  ...initialData(),
  goals: [
    {
      id: "viaje",
      name: "Viaje",
      targetCents: 100000,
      unlockDate: null,
      provider: "Nu",
      icon: "star",
      frequency: 7,
      archived: false,
      entries,
    },
  ],
});
const e = (id, cents, at = "2026-10-01T12:00:00.000Z") => ({
  id,
  cents,
  at,
  source: "manual",
});

describe("papelera", () => {
  it("lo borrado se guarda y se restaura igual", () => {
    const data = journal([e("a", 5000), e("b", 3000)]);
    const removed = removeManualEntry(data, "viaje", "b", NOW);
    expect(removed.goals[0].entries.map((x) => x.id)).toEqual(["a"]);
    expect(trashItems(removed, NOW)).toEqual([
      {
        goalId: "viaje",
        goalName: "Viaje",
        deletedAt: NOW,
        entry: e("b", 3000),
      },
    ]);
    // Survives a backup.
    const restored = restoreEntry(
      validateBackup(JSON.parse(JSON.stringify(removed))),
      "b",
      NOW,
    );
    expect(restored.goals[0].entries).toContainEqual(e("b", 3000));
    expect(trashItems(restored, NOW)).toEqual([]);
  });
  it("olvida lo que lleva más de 30 días", () => {
    const removed = removeManualEntry(
      journal([e("a", 5000)]),
      "viaje",
      "a",
      NOW,
    );
    expect(trashItems(removed, NOW + 29 * DAY)).toHaveLength(1);
    expect(trashItems(removed, NOW + 31 * DAY)).toHaveLength(0);
    expect(() => restoreEntry(removed, "a", NOW + 31 * DAY)).toThrow();
  });
  it("no restaura si dejaría la cajita en negativo", () => {
    const data = journal([
      e("in", 5000),
      e("out", -2000, "2026-10-02T12:00:00.000Z"),
    ]);
    let next = removeManualEntry(data, "viaje", "out", NOW);
    next = removeManualEntry(next, "viaje", "in", NOW + 1);
    expect(() => restoreEntry(next, "out", NOW + 2)).toThrow(/negativo/);
    expect(restoreEntry(next, "in", NOW + 2).goals[0].entries).toHaveLength(1);
  });
  it("guarda como mucho 50 y no cambia respaldos viejos", () => {
    let data = journal(Array.from({ length: 60 }, (_, i) => e(`m${i}`, 100)));
    for (let i = 0; i < 60; i++)
      data = removeManualEntry(data, "viaje", `m${i}`, NOW + i);
    expect(data.trash).toHaveLength(50);
    expect(data.trash[0].entry.id).toBe("m59");
    expect("trash" in validateBackup(journal([]))).toBe(false);
    expect(() => validateBackup({ ...journal([]), trash: "x" })).toThrow();
  });
});
