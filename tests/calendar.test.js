import { describe, expect, it } from "vitest";
import {
  RHYTHM_LABEL,
  countScheduleDays,
  isScheduleDay,
  previousScheduleDays,
  rhythmLabel,
} from "../src/calendar.js";
import { plan } from "../src/domain.js";
import {
  nextOccurrences,
  occurrences,
  reminderCalendar,
} from "../src/pet/reminders.js";

const local = (s) => new Date(s);
const goal = (unlockDate, targetCents = 120000) => ({
  targetCents,
  unlockDate,
  entries: [],
});
const RHYTHMS = [
  [7, "weekly"],
  [15, "biweekly"],
  [30, "monthly"],
];

describe("un solo calendario para el plan y los avisos", () => {
  it("quincenal es el 15 y el último día; mensual, el último día", () => {
    const days = (frequency, from, to) => {
      const out = [];
      for (let d = local(from); d < local(to); d.setDate(d.getDate() + 1))
        if (isScheduleDay(frequency, d)) out.push(d.getDate());
      return out;
    };
    expect(days(15, "2028-02-01T00:00:00", "2028-04-01T00:00:00")).toEqual([
      15, 29, 15, 31,
    ]);
    expect(days(30, "2027-01-01T00:00:00", "2027-05-01T00:00:00")).toEqual([
      31, 28, 31, 30,
    ]);
    expect(days(7, "2026-10-01T00:00:00", "2026-10-15T00:00:00").length).toBe(
      2,
    );
  });
  it("el plan divide entre las mismas fechas en que llegan los avisos", () => {
    const now = local("2026-10-16T07:00:00");
    for (const unlockDate of ["2026-11-30", "2027-02-28", "2027-08-31"])
      for (const [days, frequency] of RHYTHMS)
        for (const weekday of [0, 3, 5]) {
          const reminder = { frequency, day: weekday, time: "08:00" };
          const periods = occurrences(
            reminder,
            local("2026-10-16T00:00:00"),
            local(`${unlockDate}T00:00:00`),
          ).length;
          expect(
            countScheduleDays(
              days,
              now,
              local(`${unlockDate}T00:00:00`),
              weekday,
            ),
          ).toBe(periods);
          expect(plan(goal(unlockDate), days, now.getTime(), weekday)).toBe(
            // Rounded up to $10.
            Math.ceil(120000 / periods / 1000) * 1000,
          );
        }
  });
  it("cuenta la quincena de hoy y no la del día objetivo", () => {
    const fifteenth = local("2026-11-15T10:00:00").getTime();
    // Nov 15 (today) and Nov 30 count; Dec 15 is the target day itself.
    expect(plan(goal("2026-12-15"), 15, fifteenth)).toBe(60000);
    // Target before the next date: still one period, never zero.
    expect(plan(goal("2026-11-17"), 30, fifteenth)).toBe(120000);
  });
  it("semanal respeta el día elegido en el recordatorio", () => {
    const now = local("2026-10-16T12:00:00").getTime(); // viernes
    // Until Oct 31: Fridays 16, 23, 30 → 3; Mondays 19, 26 → 2.
    expect(plan(goal("2026-10-31", 60000), 7, now, 5)).toBe(20000);
    expect(plan(goal("2026-10-31", 60000), 7, now, 1)).toBe(30000);
  });
  it("las fechas anteriores siguen el mismo calendario", () => {
    expect(
      previousScheduleDays(15, local("2026-10-31T09:00:00"), 3).map((d) =>
        d.toDateString(),
      ),
    ).toEqual(
      ["2026-10-15", "2026-09-30", "2026-09-15"].map((s) =>
        local(`${s}T00:00:00`).toDateString(),
      ),
    );
  });
  it("el evento de calendario empieza en el próximo aviso", () => {
    const now = local("2026-10-16T12:00:00");
    for (const frequency of ["weekly", "biweekly", "monthly"]) {
      const reminder = { frequency, day: 2, time: "09:30" };
      const [next] = nextOccurrences(reminder, now, 1);
      const stamp = `${next.getFullYear()}${String(next.getMonth() + 1).padStart(2, "0")}${String(next.getDate()).padStart(2, "0")}T093000`;
      expect(reminderCalendar(reminder, now)).toContain(`DTSTART:${stamp}`);
    }
  });
  it("las etiquetas nombran las fechas reales", () => {
    expect(rhythmLabel(7)).toBe(RHYTHM_LABEL.weekly);
    expect(rhythmLabel(15)).toBe("por quincena (15 y fin de mes)");
    expect(rhythmLabel(30)).toBe("por mes (fin de mes)");
  });
});
