import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  balance,
  correctManualEntry,
  initialData,
  removeManualEntry,
  validateBackup,
} from "../src/domain.js";
import {
  addReceipt,
  possibleReceiptMatches,
  reconcileReceipt,
} from "../src/receipts/gmail.js";

const deposit = {
  id: "manual-deposit",
  cents: 120050,
  at: "2026-10-01T08:00:00-06:00",
  source: "manual",
};
const receipt = {
  id: "receipt-1",
  provider: "Nu",
  amountCents: 120050,
  at: "2026-10-01T10:00:00-06:00",
  // The parser's pattern is provisional; confirming a match is a user action.
  validated: false,
};
const goal = {
  id: "nu-goal",
  name: "Viaje",
  provider: "Nu",
  icon: "star",
  targetCents: 500000,
  unlockDate: "2026-12-01",
  frequency: 15,
  archived: false,
  entries: [deposit],
};
const state = (goals = [goal]) => ({ ...initialData(), goals });

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-14T12:00:00Z"));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("confirmación explícita de comprobantes", () => {
  it("propone solamente depósitos manuales del mismo monto, app y día local, incluso archivados", () => {
    const data = state([
      { ...goal, archived: true },
      { ...goal, id: "other-provider", provider: "Mercado Pago" },
      {
        ...goal,
        id: "other-entries",
        entries: [
          { ...deposit, id: "gmail", source: "gmail" },
          { ...deposit, id: "different-amount", cents: 120051 },
          { ...deposit, id: "different-day", at: "2026-10-02T08:00:00-06:00" },
          { ...deposit, id: "withdrawal", cents: -120050 },
        ],
      },
    ]);
    expect(possibleReceiptMatches(data, receipt)).toEqual([
      {
        goalId: goal.id,
        goalName: goal.name,
        entryId: deposit.id,
        at: deposit.at,
      },
    ]);
    expect(data.importedIds).toEqual([]);
  });

  it("compara días locales aunque el comprobante caiga en otro día UTC", () => {
    vi.stubEnv("TZ", "America/Mexico_City");
    const lateReceipt = { ...receipt, at: "2026-10-01T23:30:00-06:00" };
    expect(possibleReceiptMatches(state(), lateReceipt)).toHaveLength(1);
    expect(
      possibleReceiptMatches(state(), {
        ...receipt,
        at: "2026-10-02T00:30:00-06:00",
      }),
    ).toHaveLength(0);
  });

  it("vincula el registro elegido sin cambiar saldo, fecha ni ID y deduplica el correo", () => {
    const data = state([{ ...goal, archived: true }]);
    const next = reconcileReceipt(data, receipt, goal.id, deposit.id);
    expect(next.goals[0].entries).toEqual([{ ...deposit, source: "gmail" }]);
    expect(next.goals[0].archived).toBe(true);
    expect(balance(next.goals[0])).toBe(balance(goal));
    expect(next.importedIds).toEqual([receipt.id]);
    expect(reconcileReceipt(next, receipt, goal.id, deposit.id)).toBe(next);
    expect(addReceipt(next, receipt, goal.id)).toBe(next);
    expect(possibleReceiptMatches(next, receipt)).toEqual([]);
    expect(data.goals[0].entries[0].source).toBe("manual");
    expect(data.importedIds).toEqual([]);
  });

  it("no elige silenciosamente entre dos movimientos elegibles", () => {
    const second = { ...deposit, id: "second-deposit" };
    const data = state([{ ...goal, entries: [deposit, second] }]);
    expect(possibleReceiptMatches(data, receipt)).toHaveLength(2);
    const next = reconcileReceipt(data, receipt, goal.id, second.id);
    expect(next.goals[0].entries).toEqual([
      deposit,
      { ...second, source: "gmail" },
    ]);
    expect(balance(next.goals[0])).toBe(balance(data.goals[0]));
  });

  it("rechaza una selección inexistente o que no coincide", () => {
    for (const mismatch of [
      { ...receipt, provider: "Mercado Pago" },
      { ...receipt, amountCents: receipt.amountCents + 1 },
      { ...receipt, at: "2026-10-03T08:00:00Z" },
    ])
      expect(() =>
        reconcileReceipt(state(), mismatch, goal.id, deposit.id),
      ).toThrow();
    expect(() =>
      reconcileReceipt(state(), receipt, goal.id, "unknown"),
    ).toThrow();
    expect(() =>
      reconcileReceipt(
        state([{ ...goal, entries: [{ ...deposit, source: "gmail" }] }]),
        receipt,
        goal.id,
        deposit.id,
      ),
    ).toThrow();
  });

  it("exige confirmar un depósito distinto cuando existe un posible duplicado", () => {
    const data = state();
    expect(() => addReceipt(data, receipt, goal.id)).toThrow();
    const next = addReceipt(data, receipt, goal.id, {
      allowPossibleDuplicate: true,
    });
    expect(balance(next.goals[0])).toBe(balance(goal) + receipt.amountCents);
    expect(next.goals[0].entries).toHaveLength(2);
    expect(next.importedIds).toEqual([receipt.id]);
  });

  it("rechaza datos de correo inválidos antes de registrarlos", () => {
    const empty = state([{ ...goal, entries: [] }]);
    for (const invalid of [
      { ...receipt, id: "" },
      { ...receipt, amountCents: 0 },
      { ...receipt, amountCents: 1e11 + 1 },
      { ...receipt, at: "2026-02-30T12:00:00Z" },
      { ...receipt, at: "2026-10-15T12:00:00Z" },
      { ...receipt, provider: "unknown" },
    ])
      expect(() => addReceipt(empty, invalid, goal.id)).toThrow();
    expect(() =>
      addReceipt(
        state([{ ...goal, archived: true, entries: [] }]),
        receipt,
        goal.id,
      ),
    ).toThrow();
    expect(() =>
      addReceipt(
        state([{ ...goal, provider: "Mercado Pago", entries: [] }]),
        receipt,
        goal.id,
      ),
    ).toThrow();
    expect(empty.importedIds).toEqual([]);
  });

  it("acepta la fecha de hoy representada al mediodía durante una consulta matutina", () => {
    vi.stubEnv("TZ", "America/Mexico_City");
    vi.setSystemTime(new Date("2026-10-14T09:00:00-06:00"));
    const sameDayReceipt = {
      ...receipt,
      at: "2026-10-14T12:00:00-06:00",
    };
    const next = addReceipt(
      state([{ ...goal, entries: [] }]),
      sameDayReceipt,
      goal.id,
    );
    expect(next.goals[0].entries[0].at).toBe(sameDayReceipt.at);
    expect(validateBackup(next).goals[0].entries[0].at).toBe(sameDayReceipt.at);
    expect(() =>
      addReceipt(
        state([{ ...goal, entries: [] }]),
        {
          ...receipt,
          at: "2026-10-15T00:00:00-06:00",
        },
        goal.id,
      ),
    ).toThrow();
  });
});

describe("corrección de registros e integridad del historial", () => {
  const withdrawal = {
    id: "withdrawal",
    cents: -100000,
    at: "2026-10-02T08:00:00-06:00",
    source: "manual",
  };

  it("corrige monto y fecha sin cambiar el ID y permite eliminar un retiro manual", () => {
    const data = state([{ ...goal, entries: [deposit, withdrawal] }]);
    const next = correctManualEntry(data, goal.id, deposit.id, {
      cents: 150000,
      at: "2026-09-30T08:00:00-06:00",
    });
    expect(next.goals[0].entries[0]).toMatchObject({
      id: deposit.id,
      cents: 150000,
      at: "2026-09-30T08:00:00-06:00",
      source: "manual",
    });
    expect(balance(next.goals[0])).toBe(50000);
    expect(
      balance(removeManualEntry(next, goal.id, withdrawal.id).goals[0]),
    ).toBe(150000);
    expect(data.goals[0].entries[0]).toEqual(deposit);
  });

  it("protege registros de correo y acepta registros manuales v1 sin origen", () => {
    const imported = state([
      { ...goal, entries: [{ ...deposit, source: "gmail" }] },
    ]);
    expect(() =>
      correctManualEntry(imported, goal.id, deposit.id, deposit),
    ).toThrow();
    expect(() => removeManualEntry(imported, goal.id, deposit.id)).toThrow();
    expect(() => removeManualEntry(state(), goal.id, "unknown")).toThrow();
    const legacy = state([
      { ...goal, entries: [{ ...deposit, source: undefined }] },
    ]);
    expect(
      removeManualEntry(legacy, goal.id, deposit.id).goals[0].entries,
    ).toEqual([]);
  });

  it("rechaza correcciones con cero, exceso, fechas imposibles o futuras", () => {
    for (const change of [
      { cents: 0, at: deposit.at },
      { cents: 1e11 + 1, at: deposit.at },
      { cents: 12.5, at: deposit.at },
      { cents: deposit.cents, at: "2026-02-30T08:00:00Z" },
      { cents: deposit.cents, at: "2026-10-15T08:00:00Z" },
    ])
      expect(() =>
        correctManualEntry(state(), goal.id, deposit.id, change),
      ).toThrow();
  });

  it("impide un saldo histórico negativo aunque el saldo final siga positivo", () => {
    const later = { ...deposit, id: "later", at: "2026-10-03T08:00:00Z" };
    const data = state([{ ...goal, entries: [deposit, withdrawal, later] }]);
    expect(balance(data.goals[0])).toBeGreaterThan(0);
    expect(() => removeManualEntry(data, goal.id, deposit.id)).toThrow();
    expect(() =>
      correctManualEntry(data, goal.id, deposit.id, {
        cents: 50000,
        at: deposit.at,
      }),
    ).toThrow();
    expect(() =>
      correctManualEntry(data, goal.id, deposit.id, {
        cents: deposit.cents,
        at: "2026-10-04T08:00:00Z",
      }),
    ).toThrow();
    expect(data.goals[0].entries).toEqual([deposit, withdrawal, later]);
  });

  it("valida saldos por fecha aunque el orden de inserción sea diferente", () => {
    const valid = state([{ ...goal, entries: [withdrawal, deposit] }]);
    expect(
      validateBackup(valid).goals[0].entries.map((entry) => entry.id),
    ).toEqual([withdrawal.id, deposit.id]);
    const invalid = state([
      {
        ...goal,
        entries: [{ ...deposit, at: "2026-10-03T08:00:00Z" }, withdrawal],
      },
    ]);
    expect(balance(invalid.goals[0])).toBeGreaterThan(0);
    expect(() => validateBackup(invalid)).toThrow();
  });

  it("conserva la conciliación y campos v2 al exportar y restaurar", () => {
    const data = {
      ...state([{ ...goal, archived: true }]),
      checkins: ["2026-10-01"],
      assignments: { "nu-deposit-v1": goal.id },
      savedAt: 123456,
      preferences: {
        ...initialData().preferences,
        pet: "cow",
        petName: "Mila",
      },
    };
    const next = reconcileReceipt(data, receipt, goal.id, deposit.id);
    const restored = validateBackup(JSON.parse(JSON.stringify(next)));
    expect(restored).toEqual(next);
    expect(restored.version).toBe(2);
    expect(restored.goals[0].entries[0].source).toBe("gmail");
    expect(addReceipt(restored, receipt, goal.id)).toBe(restored);
  });
});
