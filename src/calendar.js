// One calendar for the savings plan and the reminders. A goal's rhythm is
// stored as days (7, 15, 30) for backup compatibility, but the dates are
// calendar dates: weekly on the reminder's weekday, biweekly on the 15th and
// the last day of the month, monthly on the last day of the month.
export const RHYTHM_BY_DAYS = { 7: "weekly", 15: "biweekly", 30: "monthly" };
export const RHYTHM_LABEL = {
  weekly: "por semana",
  biweekly: "por quincena (15 y fin de mes)",
  monthly: "por mes (fin de mes)",
};
// Same default weekday as a new reminder (Friday).
export const DEFAULT_WEEKDAY = 5;

export const rhythmOf = (frequency) =>
  RHYTHM_BY_DAYS[frequency] ?? frequency ?? "weekly";
export const rhythmLabel = (frequency) => RHYTHM_LABEL[rhythmOf(frequency)];

const lastDayOfMonth = (year, month) => new Date(year, month + 1, 0).getDate();
const midnight = (value) => {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
};

export function isScheduleDay(frequency, date, weekday = DEFAULT_WEEKDAY) {
  const rhythm = rhythmOf(frequency);
  if (rhythm === "weekly") return date.getDay() === weekday;
  const last = lastDayOfMonth(date.getFullYear(), date.getMonth());
  if (rhythm === "biweekly")
    return date.getDate() === 15 || date.getDate() === last;
  return date.getDate() === last;
}

/** How many calendar dates fall on days in [from, to): today counts, the
 * target day itself does not. Arithmetic, so it stays cheap for far dates. */
export function countScheduleDays(
  frequency,
  from,
  to,
  weekday = DEFAULT_WEEKDAY,
) {
  const start = midnight(from),
    end = midnight(to);
  if (!(end > start)) return 0;
  const rhythm = rhythmOf(frequency);
  if (rhythm === "weekly") {
    const days = Math.round((end - start) / 86400000),
      offset = (weekday - start.getDay() + 7) % 7;
    return offset < days ? Math.floor((days - 1 - offset) / 7) + 1 : 0;
  }
  let count = 0;
  const month = new Date(start.getFullYear(), start.getMonth(), 1);
  while (month <= end) {
    const y = month.getFullYear(),
      m = month.getMonth(),
      last = lastDayOfMonth(y, m);
    for (const day of rhythm === "biweekly" ? [15, last] : [last]) {
      const d = new Date(y, m, day);
      if (d >= start && d < end) count++;
    }
    month.setMonth(m + 1);
  }
  return count;
}

/** The `count` calendar days strictly before `date`'s day, newest first. */
export function previousScheduleDays(
  frequency,
  date,
  count,
  weekday = DEFAULT_WEEKDAY,
) {
  const out = [],
    day = midnight(date);
  for (let i = 0; i < 800 && out.length < count; i++) {
    day.setDate(day.getDate() - 1);
    if (isScheduleDay(frequency, day, weekday)) out.push(new Date(day));
  }
  return out;
}
