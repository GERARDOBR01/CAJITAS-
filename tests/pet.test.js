import { describe, it, expect } from "vitest";
import { initialData, validateBackup } from "../src/domain.js";
import {
  MESSAGES,
  answerCheckIn,
  composeMessage,
  dueCheckIn,
  easeReminders,
  nextOccurrences,
  occurrences,
  suggestedExtra,
  upcomingNotifications,
} from "../src/pet/reminders.js";
import { allowedTime, normalizeReminder } from "../src/pet/reminderSettings.js";
import {
  SAD_MS,
  daysAway,
  eyeOffset,
  growthStage,
  petMood,
  registerTap,
} from "../src/pet/state.js";

const local = (s) => new Date(s);
function dataWith(reminder, entries = [], extra = {}) {
  return {
    ...initialData(),
    preferences: {
      ...initialData().preferences,
      reminder: { ...initialData().preferences.reminder, ...reminder },
    },
    goals: [
      {
        id: "g1",
        name: "Mi escapadita",
        provider: "Nu",
        icon: "star",
        targetCents: 1200000,
        unlockDate: "2027-06-30",
        frequency: 15,
        entries,
      },
    ],
    ...extra,
  };
}

describe("estados de la mascota", () => {
  it("la celebración manda, la tristeza va después y los estados quietos al final", () => {
    expect(petMood({ celebrating: true, sad: true })).toBe("celebrate");
    expect(petMood({ sad: true, excited: true })).toBe("sad");
    expect(petMood({ excited: true, waiting: true })).toBe("excited");
    expect(petMood({ happy: true, waiting: true })).toBe("happy");
    expect(petMood({ waiting: true, daysAway: 30 })).toBe("waiting");
    expect(petMood({ daysAway: 7 })).toBe("sleepy");
    expect(petMood({ daysAway: 6 })).toBe("idle");
    expect(petMood()).toBe("idle");
  });
  it("la tristeza siempre se va sola en menos de 10 segundos", () => {
    expect(SAD_MS).toBeGreaterThan(0);
    expect(SAD_MS).toBeLessThanOrEqual(10000);
  });
  it("el brote crece en 5 etapas según el avance", () => {
    expect([0, 0.1, 0.4, 0.7, 1, 2].map(growthStage)).toEqual([
      0, 1, 2, 3, 4, 4,
    ]);
    expect(growthStage(NaN)).toBe(0);
  });
  it("duerme después de 7 días sin visitas ni depósitos", () => {
    const data = dataWith({}, [
      { id: "e1", cents: 1000, at: "2026-10-01T12:00:00", source: "manual" },
    ]);
    expect(daysAway(data, local("2026-10-08T10:00:00"))).toBe(7);
    expect(
      daysAway(
        { ...data, checkins: ["2026-10-07"] },
        local("2026-10-08T10:00:00"),
      ),
    ).toBe(1);
    expect(daysAway(initialData(), local("2026-10-08T10:00:00"))).toBe(0);
  });
  it("cinco toques rápidos activan el truco y los lentos no", () => {
    let state = { taps: [] };
    for (const t of [0, 300, 600, 900]) {
      state = registerTap(state.taps, t);
      expect(state.trick).toBe(false);
    }
    expect(registerTap(state.taps, 1200).trick).toBe(true);
    let slow = { taps: [] };
    for (const t of [0, 1000, 2500, 4000, 5500])
      slow = registerTap(slow.taps, t);
    expect(slow.trick).toBe(false);
  });
  it("los ojos siguen el dedo sin salirse", () => {
    const box = { left: 0, top: 0, width: 200, height: 200 };
    expect(eyeOffset({ x: 100, y: 100 }, box)).toEqual({ x: 0, y: 0 });
    expect(eyeOffset({ x: 5000, y: -5000 }, box)).toEqual({ x: 3, y: -3 });
    expect(eyeOffset(null, box)).toEqual({ x: 0, y: 0 });
  });
});

describe("calendario de recordatorios", () => {
  it("quincenal cae el 15 y el último día, en meses de 28, 30 y 31 días", () => {
    const r = { frequency: "biweekly", time: "09:00", day: 5 };
    const days = occurrences(
      r,
      local("2027-01-31T10:00:00"),
      local("2027-05-01T00:00:00"),
    ).map((d) => `${d.getMonth() + 1}-${d.getDate()}`);
    expect(days).toEqual(["2-15", "2-28", "3-15", "3-31", "4-15", "4-30"]);
    const leap = occurrences(
      r,
      local("2028-02-01T00:00:00"),
      local("2028-03-01T00:00:00"),
    ).map((d) => d.getDate());
    expect(leap).toEqual([15, 29]);
  });
  it("semanal respeta el día y mensual el fin de mes", () => {
    const weekly = nextOccurrences(
      { frequency: "weekly", day: 1, time: "08:30" },
      local("2026-10-15T12:00:00"),
      2,
    );
    expect(
      weekly.map((d) => [d.getDay(), d.getHours(), d.getMinutes()]),
    ).toEqual([
      [1, 8, 30],
      [1, 8, 30],
    ]);
    const monthly = nextOccurrences(
      { frequency: "monthly", day: 0, time: "20:00" },
      local("2026-10-31T21:00:00"),
      1,
    );
    expect(monthly[0].getMonth()).toBe(10);
    expect(monthly[0].getDate()).toBe(30);
  });
  it("nunca entre 22:00 y 8:00; los respaldos viejos se acomodan", () => {
    expect(allowedTime("08:00")).toBe(true);
    expect(allowedTime("21:59")).toBe(true);
    expect(allowedTime("22:00")).toBe(false);
    expect(allowedTime("07:59")).toBe(false);
    expect(
      normalizeReminder({ enabled: true, day: 5, time: "23:30" }),
    ).toMatchObject({
      frequency: "weekly",
      time: "21:30",
    });
    expect(
      normalizeReminder({ enabled: false, day: 2, time: "06:00" }).time,
    ).toBe("08:00");
    expect(() => normalizeReminder({ frequency: "daily" })).toThrow();
  });
  it("un respaldo v0.6 se migra sin perder el recordatorio", () => {
    const old = {
      ...initialData(),
      preferences: {
        ...initialData().preferences,
        reminder: { enabled: true, day: 3, time: "18:00" },
      },
    };
    expect(validateBackup(old).preferences.reminder).toMatchObject({
      enabled: true,
      frequency: "weekly",
      day: 3,
      time: "18:00",
      since: null,
    });
  });
  it("máximo un aviso por día en lo programado", () => {
    const { items } = upcomingNotifications(
      dataWith({ enabled: true, frequency: "weekly", day: 2 }),
      local("2026-10-15T12:00:00"),
      6,
    );
    const days = items.map((i) => i.at.toDateString());
    expect(new Set(days).size).toBe(days.length);
    expect(items).toHaveLength(6);
    expect(items.every((i) => i.goalId === "g1")).toBe(true);
  });
});

describe("mensajes de la mascota", () => {
  it("los mensajes no se repiten entre los últimos cinco", () => {
    const { items } = upcomingNotifications(
      dataWith({ enabled: true, frequency: "biweekly" }),
      local("2026-10-15T12:00:00"),
      8,
    );
    const ids = items.map((i) => i.id && i.body);
    for (let i = 0; i < items.length; i++) {
      const window = items.slice(Math.max(0, i - 5), i).map((x) => x.body);
      expect(window).not.toContain(items[i].body);
    }
    expect(ids.length).toBe(8);
  });
  it("ningún mensaje culpa, avergüenza, compara ni mete urgencia", () => {
    const banned =
      /culpa|fallaste|decepcion|decepción|vergüenza|olvidaste|abandon|urgente|última oportunidad|otros ahorran|los demás|deberías|me pones triste/i;
    for (const bank of Object.values(MESSAGES))
      for (const [, text] of bank) expect(text).not.toMatch(banned);
    for (const bank of Object.values(MESSAGES))
      expect(bank.length).toBeGreaterThanOrEqual(8);
  });
  it("solo sugiere más si cumplió el plan 3 periodos, y como máximo +10 % redondeado a $10", () => {
    const when = local("2026-10-31T09:00:00");
    const kept = [5, 20, 35].map((d, i) => ({
      id: `e${i}`,
      cents: 200000,
      at: new Date(when.getTime() - d * 86400000).toISOString(),
      source: "manual",
    }));
    const goal = dataWith({ frequency: "biweekly" }, kept).goals[0];
    const extra = suggestedExtra(goal, "biweekly", when);
    expect(extra).toBeGreaterThan(0);
    expect(extra % 1000).toBe(0);
    // plan for this goal right now
    const remaining = goal.targetCents - 600000,
      periods = Math.ceil(
        Math.ceil((new Date("2027-06-30T00:00:00") - when) / 86400000) / 15,
      ),
      step = Math.ceil(remaining / periods);
    expect(extra).toBeLessThanOrEqual(step * 0.1);
    // A withdrawal or a missed period means no suggestion.
    const withdrew = [
      ...kept,
      {
        id: "w",
        cents: -1000,
        at: new Date(when.getTime() - 3 * 86400000).toISOString(),
        source: "manual",
      },
    ];
    expect(
      suggestedExtra(dataWith({}, withdrew).goals[0], "biweekly", when),
    ).toBe(0);
    expect(
      suggestedExtra(dataWith({}, kept.slice(0, 2)).goals[0], "biweekly", when),
    ).toBe(0);
    const message = composeMessage(
      dataWith({ frequency: "biweekly" }, kept),
      goal,
      when,
    );
    expect(message.kind).toBe("nudge");
    expect(message.body).toMatch(/\$\d/);
  });
});

describe("respuesta y paciencia", () => {
  const since = "2026-09-01T10:00:00.000Z";
  it("espera la actualización cuando pasó un aviso sin depósito después", () => {
    const data = dataWith({ enabled: true, frequency: "biweekly", since });
    const due = dueCheckIn(data, local("2026-09-16T12:00:00"));
    expect(due.goal.id).toBe("g1");
    expect(due.at.getDate()).toBe(15);
    expect(due.message.title).toContain(data.preferences.petName);
    const paid = dataWith({ enabled: true, frequency: "biweekly", since }, [
      { id: "e", cents: 100, at: "2026-09-15T20:00:00", source: "manual" },
    ]);
    expect(dueCheckIn(paid, local("2026-09-16T12:00:00"))).toBeNull();
    expect(
      dueCheckIn(
        {
          ...data,
          preferences: {
            ...data.preferences,
            reminder: { ...data.preferences.reminder, enabled: false },
          },
        },
        local("2026-09-16T12:00:00"),
      ),
    ).toBeNull();
  });
  it("“Ahora no” no castiga: solo deja de esperar", () => {
    const data = dataWith({ enabled: true, frequency: "biweekly", since });
    const answered = answerCheckIn(data, local("2026-09-16T12:00:00"));
    expect(dueCheckIn(answered, local("2026-09-17T12:00:00"))).toBeNull();
    expect(answered.checkins).toEqual(data.checkins);
    expect(answered.preferences.reminder.frequency).toBe("biweekly");
  });
  it("tras 2 avisos ignorados escribe menos seguido, una sola vez por paso", () => {
    const data = dataWith({
      enabled: true,
      frequency: "weekly",
      day: 1,
      since,
    });
    // Mondays after 2026-09-01: 7, 14, 21 → two ignored before the latest.
    const eased = easeReminders(data, local("2026-09-22T12:00:00"));
    expect(eased.data.preferences.reminder.frequency).toBe("biweekly");
    expect(eased.notice).toContain("cada quincena");
    // Easing also stops the current wait: the next contact is the gentler one.
    expect(dueCheckIn(eased.data, local("2026-09-22T12:00:00"))).toBeNull();
    expect(easeReminders(eased.data, local("2026-09-22T12:00:00")).notice).toBe(
      "",
    );
    // One ignored is not enough.
    expect(easeReminders(data, local("2026-09-15T12:00:00")).notice).toBe("");
    // Monthly is already the gentlest.
    const monthly = dataWith({ enabled: true, frequency: "monthly", since });
    expect(easeReminders(monthly, local("2026-12-05T12:00:00")).notice).toBe(
      "",
    );
  });
});

describe("Cookie", () => {
  it("el siguiente becho llega entre 9 y 16 segundos", async () => {
    const { nextBechoDelay, BECHO_LINES, LOVE_TEXT } =
      await import("../src/components/CookieCat.jsx");
    expect(nextBechoDelay(() => 0)).toBe(9000);
    expect(nextBechoDelay(() => 0.9999)).toBeLessThanOrEqual(16000);
    expect(BECHO_LINES).toEqual(["¡BECHO!", "BECHO BECHO"]);
    expect(LOVE_TEXT).toBe("¡Te amo Jade!");
  });
  it("es la mascota por defecto", () => {
    expect(initialData().preferences).toMatchObject({
      pet: "cat",
      petName: "Cookie",
    });
  });
});
