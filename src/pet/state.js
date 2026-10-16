// Mascot state machine. Pure so the transitions can be tested without a DOM.
import { balance, localDate } from "../domain.js";

export const MOODS = [
  "idle",
  "happy",
  "excited",
  "celebrate",
  "sleepy",
  "waiting",
];
export const EXCITED_MS = 2600;
export const HAPPY_MS = 1800;
export const SLEEPY_DAYS = 7;
export const TRICK_TAPS = 5;
export const TRICK_WINDOW_MS = 2000;

/** Priority: a celebration beats everything and the quiet moods (waiting,
 * sleepy) only show when nothing else is happening. There is no sad mood:
 * using savings, even before the date, never upsets the pet. */
export function petMood({
  celebrating = false,
  excited = false,
  happy = false,
  waiting = false,
  daysAway = 0,
} = {}) {
  if (celebrating) return "celebrate";
  if (excited) return "excited";
  if (happy) return "happy";
  if (waiting) return "waiting";
  if (daysAway >= SLEEPY_DAYS) return "sleepy";
  return "idle";
}

/** Sprout on the head: seed → brote → hojas → botón → flor. */
export function growthStage(progress) {
  const p = Number.isFinite(progress) ? progress : 0;
  if (p >= 1) return 4;
  if (p >= 0.66) return 3;
  if (p >= 0.33) return 2;
  if (p > 0) return 1;
  return 0;
}

export const STAGE_NAMES = ["Semilla", "Brote", "Hojitas", "Botón", "Flor"];

export function overallProgress(data) {
  const goals = data.goals.filter((g) => !g.archived);
  const target = goals.reduce((s, g) => s + g.targetCents, 0);
  if (!target) return 0;
  return Math.min(
    1,
    goals.reduce((s, g) => s + Math.min(balance(g), g.targetCents), 0) / target,
  );
}

/** Whole days since the last visit or deposit. No goals means no nap. */
export function daysAway(data, now = new Date()) {
  if (!data.goals.length) return 0;
  const dates = [
    ...data.checkins,
    ...data.goals.flatMap((g) =>
      g.entries
        .filter((e) => e.cents > 0)
        .map((e) => localDate(new Date(e.at))),
    ),
  ];
  if (!dates.length) return 0;
  const last = dates.sort().at(-1),
    from = new Date(`${last}T00:00:00`),
    to = new Date(`${localDate(now)}T00:00:00`);
  return Math.max(0, Math.round((to - from) / 86400000));
}

/** Five quick taps unlock a little trick. Returns the kept taps. */
export function registerTap(taps, now) {
  const recent = [...taps, now].filter((t) => now - t <= TRICK_WINDOW_MS);
  if (recent.length >= TRICK_TAPS) return { taps: [], trick: true };
  return { taps: recent, trick: false };
}

/** Pupils follow the finger a little, never leaving the eye. */
export function eyeOffset(point, box, max = 3) {
  if (!point || !box?.width || !box?.height) return { x: 0, y: 0 };
  const cx = box.left + box.width / 2,
    cy = box.top + box.height / 2,
    dx = (point.x - cx) / (box.width / 2),
    dy = (point.y - cy) / (box.height / 2),
    clamp = (v) => Math.max(-1, Math.min(1, v)) * max;
  return {
    x: Math.round(clamp(dx) * 10) / 10,
    y: Math.round(clamp(dy) * 10) / 10,
  };
}

export const MOOD_LABEL = {
  idle: "te acompaña",
  happy: "está feliz",
  excited: "salta de gusto por tu ahorro",
  celebrate: "celebra tu meta",
  sleepy: "está tomando una siesta",
  waiting: "espera tu actualización de ahorro",
};

/** What the app says after a withdrawal: neutral, never guilt. */
export const WITHDRAWAL_NOTE =
  "Retiro registrado. Usar tu ahorro cuando lo necesitas también es cumplir su propósito.";
