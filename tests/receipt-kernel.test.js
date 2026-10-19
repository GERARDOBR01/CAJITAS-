import { describe, expect, it } from "vitest";
import { initialData } from "../src/domain.js";
import { possibleReceiptMatches } from "../src/receipts/gmail.js";
import { possibleLocalMatches } from "../src/receipts/local.js";
import { findMatches, registerDeposit } from "../src/receipts/kernel.js";

const at = "2026-10-10T15:00:00.000Z";
const journal = (entries) => ({
  ...initialData(),
  goals: [
    {
      id: "g1",
      name: "Viaje",
      provider: "Nu",
      icon: "star",
      targetCents: 100000,
      unlockDate: null,
      entries,
    },
  ],
});
const entry = (id, source, extra = {}) => ({
  id,
  cents: 5000,
  at,
  source,
  ...extra,
});
const gmailReceipt = { id: "m1", provider: "Nu", amountCents: 5000, at };
const localReceipt = {
  id: `local-email:${"a".repeat(64)}`,
  provider: "Nu",
  amountCents: 5000,
  at,
};

describe("receipt import: what both sources agree on", () => {
  it("recognises the same amount, app and day in both", () => {
    const data = journal([entry("e1", "manual")]);
    expect(possibleReceiptMatches(data, gmailReceipt)).toHaveLength(1);
    expect(possibleLocalMatches(data, localReceipt)).toHaveLength(1);
  });

  it("ignores another amount, another app and a receipt already seen", () => {
    const data = journal([entry("e1", "manual")]);
    const other = (patch) => ({ ...gmailReceipt, ...patch });
    expect(possibleReceiptMatches(data, other({ amountCents: 5100 }))).toEqual(
      [],
    );
    expect(possibleReceiptMatches(data, other({ provider: "Bitso" }))).toEqual(
      [],
    );
    expect(
      possibleReceiptMatches({ ...data, importedIds: ["m1"] }, gmailReceipt),
    ).toEqual([]);
  });
});

describe("receipt import: what each source decides for itself", () => {
  it("Gmail only matches typed-in movements; a local file matches any deposit", () => {
    const data = journal([entry("e1", "gmail"), entry("e2", "guardian")]);
    expect(possibleReceiptMatches(data, gmailReceipt)).toEqual([]);
    const found = possibleLocalMatches(data, localReceipt);
    expect(found.map((m) => [m.entryId, m.source])).toEqual([
      ["e1", "gmail"],
      ["e2", "guardian"],
    ]);
  });
});

describe("kernel", () => {
  it("registers the deposit and counts the receipt as seen", () => {
    const next = registerDeposit(journal([]), gmailReceipt, "g1", "gmail");
    expect(next.importedIds).toEqual(["m1"]);
    expect(next.goals[0].entries[0]).toMatchObject({
      cents: 5000,
      at,
      source: "gmail",
    });
  });

  it("lets the caller choose which movements count", () => {
    const data = journal([entry("e1", "manual"), entry("e2", "gmail")]);
    const only = findMatches(data, gmailReceipt, {
      canMatch: (e) => e.id === "e2",
    });
    expect(only.map((m) => m.entryId)).toEqual(["e2"]);
  });
});
