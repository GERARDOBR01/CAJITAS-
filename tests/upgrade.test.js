import { describe, it, expect } from "vitest";
import {
  initialData,
  checkIn,
  companionship,
  validateBackup,
  activityCSV,
  balance,
  balanceHistory,
  goalSummary,
  activeGoals,
  LEGACY_STORAGE_KEY,
  STORAGE_KEY,
  migrateStorageKey,
} from "../src/domain.js";
import { reminderCalendar } from "../src/pet/reminders.js";
const goal = {
  id: "g",
  name: "Mi viaje",
  provider: "Nu",
  icon: "cloud",
  targetCents: 100000,
  unlockDate: "2026-12-01",
  frequency: 15,
  archived: false,
  entries: [
    { id: "e1", cents: 10000, at: "2026-10-12T12:00:00", source: "manual" },
    { id: "e2", cents: 5000, at: "2026-10-12T15:00:00", source: "manual" },
  ],
};
describe("hábitos, mascotas y registros honestos", () => {
  it("una visita no registra dinero y no cuenta dos veces un día con depósitos", () => {
    const data = { ...initialData(), goals: [goal] };
    const next = checkIn(data, "2026-10-12");
    expect(balance(next.goals[0])).toBe(15000);
    expect(companionship(next).days).toBe(1);
    expect(checkIn(next, "2026-10-12")).toBe(next);
    expect(
      companionship(checkIn(checkIn(next, "2026-10-13"), "2026-10-14")),
    ).toMatchObject({ level: 2, days: 3, next: 7 });
  });
  it("migra respaldo v1 y conserva mascota, frecuencia y archivos en v2", () => {
    const old = {
      version: 1,
      goals: [{ ...goal, frequency: undefined, archived: undefined }],
      importedIds: ["email"],
      assignments: {},
    };
    const migrated = validateBackup(old);
    expect(migrated.version).toBe(2);
    expect(migrated.goals[0]).toMatchObject({ frequency: 7, archived: false });
    expect(balance(migrated.goals[0])).toBe(15000);
    const custom = {
      ...migrated,
      preferences: {
        ...migrated.preferences,
        pet: "cow",
        petName: "Mumu",
        accessory: "bow",
      },
      goals: [{ ...goal, archived: true }],
    };
    const restored = validateBackup(custom);
    expect(restored.preferences.petName).toBe("Mumu");
    expect(activeGoals(restored)).toHaveLength(0);
    expect(balance(restored.goals[0])).toBe(15000);
    expect(() =>
      validateBackup({
        ...custom,
        preferences: { ...custom.preferences, pet: "unknown" },
      }),
    ).toThrow();
  });
  it("CSV evita fórmulas en nombres y conserva centavos y filas citadas", () => {
    const data = {
      ...initialData(),
      goals: [{ ...goal, name: '=HYPERLINK("url")' }],
    };
    const csv = activityCSV(data);
    expect(csv).toContain('"\'=HYPERLINK(""url"")"');
    expect(csv).toContain(",100.00,");
    expect(csv.startsWith("\ufeffFecha,")).toBe(true);
  });
  it("el historial representa saldo neto y no proyecciones inventadas", () => {
    const data = {
      ...initialData(),
      goals: [
        {
          ...goal,
          entries: [
            ...goal.entries,
            { id: "withdraw", cents: -3000, at: "2026-10-13T12:00:00" },
          ],
        },
      ],
    };
    expect(
      balanceHistory(data, 3, new Date("2026-10-14T12:00:00")).map(
        (p) => p.cents,
      ),
    ).toEqual([15000, 12000, 12000]);
    expect(goalSummary(goal, new Date("2027-01-01").getTime())).toMatchObject({
      pastDue: true,
      remaining: 85000,
    });
  });
  it("el recordatorio de calendario es semanal y arranca en el próximo horario local", () => {
    const calendar = reminderCalendar(
      { day: 5, time: "18:00" },
      new Date("2026-10-14T12:00:00Z"),
    );
    expect(calendar).toContain("RRULE:FREQ=WEEKLY;BYDAY=FR");
    expect(calendar).toContain("DTSTART:20261016T180000");
    expect(calendar).toContain("END:VCALENDAR");
  });
});

describe("cambio de nombre a Guardadito", () => {
  const memory = (values) => ({
    values: new Map(Object.entries(values)),
    getItem(key) {
      return this.values.has(key) ? this.values.get(key) : null;
    },
    setItem(key, value) {
      this.values.set(key, value);
    },
  });
  it("copia los datos guardados como Cajitas a la clave nueva una sola vez", () => {
    const raw = JSON.stringify(initialData());
    const storage = memory({ [LEGACY_STORAGE_KEY]: raw });
    expect(migrateStorageKey(storage)).toBe(true);
    expect(storage.getItem(STORAGE_KEY)).toBe(raw);
    expect(storage.getItem(LEGACY_STORAGE_KEY)).toBe(raw);
    expect(
      validateBackup(JSON.parse(storage.getItem(STORAGE_KEY))),
    ).toBeTruthy();
    storage.setItem(STORAGE_KEY, "nuevo");
    expect(migrateStorageKey(storage)).toBe(false);
    expect(storage.getItem(STORAGE_KEY)).toBe("nuevo");
    expect(migrateStorageKey(memory({}))).toBe(false);
  });
});
