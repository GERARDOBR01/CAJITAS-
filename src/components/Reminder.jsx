import { useState } from "react";
import { isComplete } from "../domain.js";
import { saveFile, isNative, haptic } from "../platform.js";
import { allowReminders } from "../reminders/device.js";
import {
  composeMessage,
  nextOccurrences,
  reminderCalendar,
} from "../pet/reminders.js";
import { allowedTime } from "../pet/reminderSettings.js";

const FREQUENCY_OPTIONS = [
  ["weekly", "Cada semana"],
  ["biweekly", "Cada quincena"],
  ["monthly", "Cada mes"],
];
const DAYS = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];
const shortDate = new Intl.DateTimeFormat("es-MX", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

/** When the pet asks how much was put aside. */
export default function Reminder({ data, onSave, notify }) {
  const prefs = data.preferences,
    [draft, setDraft] = useState(prefs.reminder),
    [saving, setSaving] = useState(false);
  const set = (change) => setDraft({ ...draft, ...change });
  async function save(e) {
    e.preventDefault();
    if (!allowedTime(draft.time)) {
      notify("Elige una hora entre 8:00 y 21:59. De noche no molestamos.");
      return;
    }
    setSaving(true);
    try {
      const turningOn = draft.enabled && !prefs.reminder.enabled;
      if (turningOn) await allowReminders();
      const reminder = {
        ...draft,
        since:
          turningOn || !draft.since ? new Date().toISOString() : draft.since,
        ignored: 0,
      };
      if (onSave({ ...data, preferences: { ...prefs, reminder } })) {
        notify(
          reminder.enabled
            ? `Listo. ${prefs.petName} te va a recordar.`
            : "Recordatorio apagado.",
        );
        await haptic();
      }
    } catch (error) {
      notify(error.message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <form
      className="reminder-screen"
      aria-labelledby="reminder-title"
      onSubmit={save}
      // Our own message explains the night hours better than the browser's.
      noValidate
    >
      <h1 id="reminder-title">Recordatorio</h1>
      <p className="muted">
        {prefs.petName} te pregunta cuánto apartaste. Sin presión.
      </p>
      <label className="checkbox switch">
        <input
          type="checkbox"
          checked={draft.enabled}
          onChange={(e) => set({ enabled: e.target.checked })}
        />
        Recordarme guardar
      </label>
      <fieldset className="chips" disabled={!draft.enabled}>
        <legend>¿Cada cuándo?</legend>
        {FREQUENCY_OPTIONS.map(([key, title]) => (
          <button
            type="button"
            key={key}
            aria-pressed={draft.frequency === key}
            onClick={() => set({ frequency: key })}
          >
            {title}
          </button>
        ))}
      </fieldset>
      <div className="form-row">
        {draft.frequency === "weekly" && (
          <label>
            Día
            <select
              value={draft.day}
              disabled={!draft.enabled}
              onChange={(e) => set({ day: Number(e.target.value) })}
            >
              {DAYS.map((day, i) => (
                <option key={day} value={i}>
                  {day}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          Hora
          <input
            type="time"
            min="08:00"
            max="21:59"
            value={draft.time}
            disabled={!draft.enabled}
            onChange={(e) => set({ time: e.target.value })}
            required
          />
        </label>
      </div>
      {draft.enabled && allowedTime(draft.time) && (
        <ReminderPreview data={data} reminder={draft} />
      )}
      <button className="primary full" disabled={saving}>
        {saving ? "Guardando…" : "Guardar"}
      </button>
      <p className="small-text muted">
        Nunca de noche. Si no contestas, te escribe menos seguido.
        {!isNative && " En la web te espera al abrir Guardadito."}
      </p>
      {!isNative && draft.enabled && (
        <button
          type="button"
          className="text-button"
          onClick={async () => {
            try {
              await saveFile(
                reminderCalendar(draft),
                "guardadito-recordatorio.ics",
                "text/calendar",
              );
              notify("Ábrelo en tu calendario para recibir el aviso.");
            } catch (e) {
              notify(e.message);
            }
          }}
        >
          Agregar a mi calendario
        </button>
      )}
    </form>
  );
}

function ReminderPreview({ data, reminder }) {
  const preview = {
      ...data,
      preferences: {
        ...data.preferences,
        reminder: { ...reminder, enabled: true },
      },
    },
    next = nextOccurrences(preview.preferences.reminder, new Date(), 3),
    goal = data.goals.find((g) => !g.archived && !isComplete(g)),
    sample = goal && next[0] ? composeMessage(preview, goal, next[0]) : null;
  return (
    <div className="reminder-preview">
      <p className="small-text">
        <strong>Próximos:</strong>{" "}
        {next.map((d) => shortDate.format(d)).join(" · ")}
      </p>
      {sample && (
        <p className="notification-sample" aria-label="Ejemplo de aviso">
          <strong>{sample.title}</strong>
          {sample.body}
        </p>
      )}
    </div>
  );
}
