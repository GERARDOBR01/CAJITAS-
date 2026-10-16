// Reminder schedule and the pet's message bank. Pure functions: the platform
// layer turns the result into native notifications or an in-app check-in.
import { balance, byTargetDate, plan, money } from "../domain.js";
import {
  FREQUENCIES,
  FREQUENCY_DAYS,
  FREQUENCY_LABEL,
} from "./reminderSettings.js";

const PERIOD = {
  weekly: { now: "esta semana", plural: "semanas", together: "seguidas" },
  biweekly: { now: "esta quincena", plural: "quincenas", together: "seguidas" },
  monthly: { now: "este mes", plural: "meses", together: "seguidos" },
};

/** Banco de mensajes en voz de la mascota. Nunca culpa, vergüenza ni urgencia. */
export const MESSAGES = {
  checkin: [
    ["c1", "¡Hola! ¿Cuánto apartaste {periodo} para {cajita}?"],
    ["c2", "Pasaba a saludar 👋 ¿Le diste un pasito a {cajita} {periodo}?"],
    ["c3", "{cajita} quiere saber cómo va. ¿Me cuentas lo que apartaste?"],
    ["c4", "¿Ya apartaste algo {periodo}? Regístralo y lo celebramos juntos."],
    ["c5", "Toc, toc 🌱 Vengo por la actualización de {cajita}."],
    ["c6", "Un ratito para tus sueños: ¿cuánto lleva {cajita}?"],
    [
      "c7",
      "¿Cómo te fue {periodo}? Cualquier pasito cuenta, aunque sea chiquito.",
    ],
    ["c8", "Aquí sigo cuidando {cajita}. ¿Registramos tu avance?"],
  ],
  cheer: [
    ["a1", "¡{n} {periodos} {seguidas}! {cajita} está creciendo bonito."],
    ["a2", "Tu constancia me tiene feliz: {n} {periodos} con ahorro ✦"],
    [
      "a3",
      "{cajita} va en serio: {n} {periodos} {seguidas}. ¿Cuánto apartaste ahora?",
    ],
    ["a4", "Racha de {n} {periodos} 🎉 Cuéntame cómo te fue esta vez."],
    ["a5", "Me encanta este ritmo: {n} {periodos} {seguidas}. ¿Seguimos?"],
    ["a6", "¡Mira nada más! {n} {periodos} ahorrando para {cajita}."],
    ["a7", "Pasito a pasito ya son {n} {periodos}. ¿Registramos el de hoy?"],
    [
      "a8",
      "{n} {periodos} {seguidas} 🌱 Vengo por la actualización de {cajita}.",
    ],
  ],
  nudge: [
    [
      "n1",
      "Vas súper con {cajita}. ¿Y si esta vez probamos {monto} más? Solo si te late.",
    ],
    [
      "n2",
      "Tu plan va al día ✦ ¿Te animas a sumar {monto} extra? Si no, todo bien.",
    ],
    ["n3", "¿Un retito? {monto} más para {cajita}. Tú decides."],
    [
      "n4",
      "Estás cumpliendo tu plan 🌱 Si te sobra, {monto} más acercan tu meta.",
    ],
    [
      "n5",
      "Idea chiquita: {monto} extra esta vez. Y si no se puede, seguimos igual.",
    ],
    ["n6", "Llevas buen ritmo. ¿Probamos {monto} más? Sin presión."],
    [
      "n7",
      "{cajita} crece bonito. Si hoy se puede, {monto} extra le vienen bien.",
    ],
    [
      "n8",
      "¿Le damos un empujoncito a {cajita}? {monto} más, solo si te acomoda.",
    ],
  ],
};

const lastDayOfMonth = (d) =>
  new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();

export function isReminderDay(reminder, date) {
  if (reminder.frequency === "weekly") return date.getDay() === reminder.day;
  const last = lastDayOfMonth(date);
  if (reminder.frequency === "biweekly")
    return date.getDate() === 15 || date.getDate() === last;
  return date.getDate() === last;
}

function at(reminder, day) {
  const [h, m] = reminder.time.split(":").map(Number);
  const d = new Date(day);
  d.setHours(h, m, 0, 0);
  return d;
}

/** Reminder instants in (from, to], oldest first. */
export function occurrences(reminder, from, to) {
  const start = new Date(from),
    end = new Date(to),
    out = [];
  if (!(end > start)) return out;
  const day = new Date(start);
  day.setHours(0, 0, 0, 0);
  // Bounded walk: one year of days is plenty for anything the UI asks.
  for (let i = 0; i < 400 && day <= end; i++) {
    if (isReminderDay(reminder, day)) {
      const instant = at(reminder, day);
      if (instant > start && instant <= end) out.push(instant);
    }
    day.setDate(day.getDate() + 1);
  }
  return out;
}

export function nextOccurrences(reminder, from, count = 6) {
  const out = [],
    day = new Date(from);
  day.setHours(0, 0, 0, 0);
  for (let i = 0; i < 800 && out.length < count; i++) {
    if (isReminderDay(reminder, day)) {
      const instant = at(reminder, day);
      if (instant > from) out.push(instant);
    }
    day.setDate(day.getDate() + 1);
  }
  return out;
}

function openGoals(data) {
  return data.goals
    .filter((g) => !g.archived && balance(g) < g.targetCents)
    .sort(byTargetDate);
}

function lastDeposit(data) {
  return Math.max(
    0,
    ...data.goals.flatMap((g) =>
      g.entries.filter((e) => e.cents > 0).map((e) => Date.parse(e.at)),
    ),
  );
}

/** How the goal went in the last periods before `when`. */
export function goalRhythm(goal, frequency, when) {
  const days = FREQUENCY_DAYS[frequency],
    span = days * 86400000,
    end = new Date(when).getTime(),
    periods = [];
  for (let k = 0; k < 6; k++) {
    const to = end - k * span,
      from = to - span,
      inside = goal.entries.filter((e) => {
        const t = Date.parse(e.at);
        return t > from && t <= to;
      });
    periods.push({
      saved: inside.filter((e) => e.cents > 0).reduce((s, e) => s + e.cents, 0),
      withdrew: inside.some((e) => e.cents < 0),
    });
  }
  let inRow = 0;
  while (inRow < periods.length && periods[inRow].saved > 0) inRow++;
  return { periods, inRow };
}

/** Suggest a bigger step only when the last 3 periods met the plan and had no
 * withdrawals. Never more than +10 % of the plan, rounded down to $10. */
export function suggestedExtra(goal, frequency, when) {
  const step = plan(goal, FREQUENCY_DAYS[frequency], new Date(when).getTime());
  // No target date (null) or nothing left: never suggest saving more.
  if (!(step > 0)) return 0;
  const { periods } = goalRhythm(goal, frequency, when);
  const kept = periods.slice(0, 3).every((p) => !p.withdrew && p.saved >= step);
  if (!kept) return 0;
  return Math.floor((step * 0.1) / 1000) * 1000;
}

export function messageKind(goal, frequency, when) {
  const extra = suggestedExtra(goal, frequency, when);
  if (extra > 0) return { kind: "nudge", extra };
  const { inRow } = goalRhythm(goal, frequency, when);
  if (inRow >= 2) return { kind: "cheer", n: inRow };
  return { kind: "checkin" };
}

export function chooseMessage(kind, avoid, seed) {
  const bank = MESSAGES[kind],
    fresh = bank.filter(([id]) => !avoid.includes(id)),
    pool = fresh.length ? fresh : bank;
  return pool[Math.abs(seed) % pool.length];
}

export function fill(text, values) {
  return text.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? "");
}

export function composeMessage(data, goal, when, avoid = []) {
  const reminder = data.preferences.reminder,
    period = PERIOD[reminder.frequency],
    context = messageKind(goal, reminder.frequency, when),
    seed = Math.floor(new Date(when).getTime() / 86400000),
    [id, text] = chooseMessage(context.kind, avoid, seed);
  return {
    id,
    kind: context.kind,
    title: `${data.preferences.petName} ✦`,
    body: fill(text, {
      cajita: goal.name,
      periodo: period.now,
      periodos: context.n === 1 ? period.plural.slice(0, -1) : period.plural,
      seguidas: period.together,
      n: context.n,
      monto: context.extra ? money(context.extra) : "",
    }),
    extra: context.extra ?? 0,
  };
}

/** Upcoming notifications for the native scheduler. Messages rotate so none of
 * the last five repeats; the caller stores `recent` back into preferences. */
export function upcomingNotifications(data, from = new Date(), count = 6) {
  const reminder = data.preferences.reminder,
    goals = openGoals(data);
  if (!reminder.enabled || !goals.length)
    return { items: [], recent: reminder.recent };
  const recent = [...reminder.recent],
    items = nextOccurrences(reminder, from, count).map((when, i) => {
      const goal = goals[i % goals.length],
        message = composeMessage(data, goal, when, recent.slice(-5));
      recent.push(message.id);
      return { id: 71500 + i, at: when, goalId: goal.id, ...message };
    });
  return { items, recent: recent.slice(-5) };
}

/** The check-in the pet is waiting for, if a reminder already passed and no
 * deposit was registered after it. */
export function dueCheckIn(data, now = new Date()) {
  const reminder = data.preferences.reminder;
  if (!reminder.enabled || !reminder.since) return null;
  const goals = openGoals(data);
  if (!goals.length) return null;
  const passed = occurrences(reminder, reminder.since, now);
  if (!passed.length) return null;
  const latest = passed.at(-1);
  if (lastDeposit(data) >= latest.getTime()) return null;
  const goal = goals[0];
  return {
    at: latest,
    goal,
    ignored: passed.filter((p) => p.getTime() > lastDeposit(data)).length - 1,
    message: composeMessage(data, goal, latest, reminder.recent),
  };
}

/** After two reminders in a row went unanswered, write less often instead of
 * insisting. Returns the data unchanged when nothing needs to move. */
export function easeReminders(data, now = new Date()) {
  const due = dueCheckIn(data, now);
  const reminder = data.preferences.reminder;
  if (!due || due.ignored < 2) return { data, notice: "" };
  const index = FREQUENCIES.indexOf(reminder.frequency);
  if (index === FREQUENCIES.length - 1) return { data, notice: "" };
  const frequency = FREQUENCIES[index + 1],
    since = new Date(now).toISOString();
  return {
    data: {
      ...data,
      preferences: {
        ...data.preferences,
        reminder: { ...reminder, frequency, since, ignored: 0 },
      },
    },
    notice: `Te escribiré ${FREQUENCY_LABEL[frequency]} para no molestar 💛`,
  };
}

/** Answering the check-in (registering or "ahora no") never lowers anything. */
export function answerCheckIn(data, now = new Date()) {
  return {
    ...data,
    preferences: {
      ...data.preferences,
      reminder: {
        ...data.preferences.reminder,
        since: new Date(now).toISOString(),
        ignored: 0,
      },
    },
  };
}
