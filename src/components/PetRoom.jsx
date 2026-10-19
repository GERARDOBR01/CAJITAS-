import { useState } from "react";
import Mascot from "./Mascot.jsx";
import { PETS, availablePets, petWords } from "../pet/catalog.js";
import {
  companionship,
  checkIn,
  today,
  isComplete,
  streak,
} from "../domain.js";
import { saveFile, isNative, haptic } from "../platform.js";
import { allowReminders } from "../reminders/device.js";
import {
  composeMessage,
  nextOccurrences,
  reminderCalendar,
} from "../pet/reminders.js";
import { allowedTime } from "../pet/reminderSettings.js";
import {
  daysAway,
  growthStage,
  overallProgress,
  petMood,
  STAGE_NAMES,
} from "../pet/state.js";

const FREQUENCY_OPTIONS = [
  ["weekly", "Semanal", "Un día de la semana"],
  ["biweekly", "Quincenal", "Días 15 y fin de mes"],
  ["monthly", "Mensual", "Fin de mes"],
];
const shortDate = new Intl.DateTimeFormat("es-MX", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});
export default function PetRoom({ data, onSave, notify }) {
  const prefs = data.preferences,
    friend = companionship(data),
    [draft, setDraft] = useState(prefs),
    [saving, setSaving] = useState(false),
    [bubble, setBubble] = useState("");
  const checked = data.checkins.includes(today());
  async function save(e) {
    e.preventDefault();
    if (!draft.petName.trim() || !allowedTime(draft.reminder.time)) {
      notify(
        "Elige un nombre y una hora entre 8:00 y 21:59. De noche no molestamos.",
      );
      return;
    }
    setSaving(true);
    try {
      const turningOn = draft.reminder.enabled && !prefs.reminder.enabled;
      if (turningOn) await allowReminders();
      const reminder = {
        ...draft.reminder,
        since:
          turningOn || !draft.reminder.since
            ? new Date().toISOString()
            : draft.reminder.since,
        ignored: 0,
      };
      if (
        onSave({
          ...data,
          preferences: { ...draft, reminder, petName: draft.petName.trim() },
        })
      ) {
        notify("Tu compañía está lista. ¡Qué bonita amistad!");
        await haptic();
      }
    } catch (error) {
      notify(error.message);
    } finally {
      setSaving(false);
    }
  }
  function choose(key) {
    setDraft({ ...draft, pet: key, petName: PETS[key].name });
  }
  const badges = [
    { icon: "✦", title: "Un sueño en camino", unlocked: data.goals.length > 0 },
    { icon: "♡", title: "Tres días de compañía", unlocked: friend.days >= 3 },
    {
      icon: "✿",
      title: "Una meta cumplida",
      unlocked: data.goals.some(isComplete),
    },
    {
      icon: "☀",
      title: "Una semana de ahorro",
      unlocked: streak(data.goals) >= 7,
    },
  ];
  return (
    <section className="pet-room">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Una amistad que florece</p>
          <h1>Tu pequeño gran compañero</h1>
          <p className="muted">
            Cuida tus hábitos. El dinero no mide tu amistad.
          </p>
        </div>
      </div>
      <div className="pet-room-layout">
        <div className="pet-garden panel">
          <span className="pet-level">
            Nivel {friend.level} · {friend.title}
          </span>
          <Mascot
            pet={draft.pet}
            name={draft.petName}
            accessory={draft.accessory}
            progress={overallProgress(data)}
            mood={petMood({ daysAway: daysAway(data) })}
            motion={draft.animations}
            interactive
            lines={petWords(data.preferences).lines}
            loveText={petWords(data.preferences).loveText}
            onTrick={() => setBubble("¡Ta-dá! Mi truco secreto ✦")}
            onPet={() => {
              haptic();
              setBubble("Un abrazo para ti. Gracias por venir ♡");
            }}
          />
          <h2>{draft.petName || PETS[draft.pet].name}</h2>
          <p className="sprout-stage">
            🌱 Su brote: {STAGE_NAMES[growthStage(overallProgress(data))]}.
            Crece con el avance de tus cajitas.
          </p>
          <p className="pet-speech">
            {bubble || petWords({ ...data.preferences, pet: draft.pet }).motto}
          </p>
          <div className="friendship-meter">
            <div className="progress">
              <span style={{ width: `${friend.progress * 100}%` }} />
            </div>
            <p>
              {friend.next
                ? `${friend.days} días de compañía · ${friend.next - friend.days} para el siguiente nivel`
                : "Una gran amistad. Cada visita sigue contando."}
            </p>
          </div>
          <button
            className="primary"
            disabled={checked}
            onClick={() => {
              if (onSave(checkIn(data))) {
                haptic();
                notify("Visita guardada. Tu ahorro registrado no cambió.");
              }
            }}
          >
            {checked ? "♡ Ya nos acompañamos hoy" : "♡ Visitar a mi compañero"}
          </button>
          <p className="small-text muted">
            Una visita o un día con depósito cuenta una sola vez. Puedes venir
            sin ahorrar.
          </p>
        </div>
        <form className="panel pet-customizer" onSubmit={save}>
          <h2>¿Quién te acompaña?</h2>
          <p className="muted">Elige a tu cómplice de sueños.</p>
          <div className="pet-options">
            {availablePets(data.preferences)
              .map((key) => [key, PETS[key]])
              .map(([key, pet]) => (
                <button
                  className={draft.pet === key ? "selected" : ""}
                  type="button"
                  key={key}
                  aria-pressed={draft.pet === key}
                  aria-label={`Elegir ${pet.label}`}
                  onClick={() => choose(key)}
                >
                  <span className="pet-thumb" style={{ "--tint": pet.color }}>
                    <Mascot pet={key} small accessory="leaf" />
                  </span>
                  <strong>{pet.label}</strong>
                  <small>{pet.name}</small>
                </button>
              ))}
          </div>
          <label>
            Su nombre
            <input
              value={draft.petName}
              maxLength={32}
              required
              onChange={(e) => setDraft({ ...draft, petName: e.target.value })}
            />
          </label>
          <fieldset>
            <legend>Su detalle favorito</legend>
            <div className="accessory-options">
              {[
                ["leaf", "🌱", "Brote"],
                ["bow", "🎀", "Moñito"],
                ["scarf", "🧣", "Bufanda"],
                ["star", "⭐", "Estrella"],
              ].map(([key, icon, title]) => (
                <button
                  type="button"
                  aria-pressed={draft.accessory === key}
                  className={draft.accessory === key ? "selected" : ""}
                  key={key}
                  onClick={() => setDraft({ ...draft, accessory: key })}
                >
                  <span>{icon}</span>
                  {title}
                </button>
              ))}
            </div>
          </fieldset>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={draft.animations}
              onChange={(e) =>
                setDraft({ ...draft, animations: e.target.checked })
              }
            />
            Animaciones suaves y destellitos
          </label>
          <p className="small-text muted">
            Se respeta también la opción de reducir movimiento de tu
            dispositivo.
          </p>
          <button
            className="primary full"
            disabled={saving || !draft.petName.trim()}
          >
            {saving ? "Guardando…" : "Guardar mi compañero"}
          </button>
        </form>
      </div>
      <section className="panel badges-panel">
        <h2>Pequeños grandes logros</h2>
        <div className="badge-collection">
          {badges.map((b) => (
            <div key={b.title} className={b.unlocked ? "earned" : "waiting"}>
              <span>{b.icon}</span>
              <strong>{b.title}</strong>
              <small>{b.unlocked ? "Ya floreció" : "A tu ritmo"}</small>
            </div>
          ))}
        </div>
      </section>
      <section className="panel reminder-panel">
        <h2>{draft.petName || "Tu compañero"} te recuerda</h2>
        <p className="muted">
          Te pregunta cuánto apartaste. Tú decides si registras algo; nunca
          mueve dinero.
        </p>
        <label className="checkbox switch">
          <input
            type="checkbox"
            checked={draft.reminder.enabled}
            onChange={(e) =>
              setDraft({
                ...draft,
                reminder: { ...draft.reminder, enabled: e.target.checked },
              })
            }
          />
          Recordarme registrar mi ahorro
        </label>
        <fieldset
          className="frequency-options"
          disabled={!draft.reminder.enabled}
        >
          <legend>¿Cada cuándo?</legend>
          {FREQUENCY_OPTIONS.map(([key, title, hint]) => (
            <button
              type="button"
              key={key}
              aria-pressed={draft.reminder.frequency === key}
              className={draft.reminder.frequency === key ? "selected" : ""}
              onClick={() =>
                setDraft({
                  ...draft,
                  reminder: { ...draft.reminder, frequency: key },
                })
              }
            >
              <strong>{title}</strong>
              <small>{hint}</small>
            </button>
          ))}
        </fieldset>
        <div className="form-row">
          {draft.reminder.frequency === "weekly" && (
            <label>
              Día
              <select
                value={draft.reminder.day}
                disabled={!draft.reminder.enabled}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    reminder: {
                      ...draft.reminder,
                      day: Number(e.target.value),
                    },
                  })
                }
              >
                {[
                  "Domingo",
                  "Lunes",
                  "Martes",
                  "Miércoles",
                  "Jueves",
                  "Viernes",
                  "Sábado",
                ].map((day, i) => (
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
              value={draft.reminder.time}
              disabled={!draft.reminder.enabled}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  reminder: { ...draft.reminder, time: e.target.value },
                })
              }
              required
            />
          </label>
        </div>
        {draft.reminder.enabled && allowedTime(draft.reminder.time) && (
          <ReminderPreview data={data} draft={draft} />
        )}
        <button
          className="primary"
          disabled={saving}
          onClick={() => save({ preventDefault() {} })}
        >
          {saving ? "Guardando…" : "Guardar recordatorio"}
        </button>
        <p className="small-text muted">
          Máximo un aviso al día y nunca entre 22:00 y 8:00. Si dos avisos
          seguidos se quedan sin respuesta, te escribirá menos seguido.
          {isNative
            ? " La entrega puede variar por batería y ajustes del teléfono."
            : " En la web te espera al abrir Guardadito; para avisos con la app cerrada, agrégalo a tu calendario o instala la app de Android."}
        </p>
        {!isNative && (
          <button
            className="secondary"
            onClick={async () => {
              try {
                await saveFile(
                  reminderCalendar(draft.reminder),
                  "cajitas-recordatorio.ics",
                  "text/calendar",
                );
                notify(
                  "Abre el archivo en tu calendario para activar el recordatorio.",
                );
              } catch (e) {
                notify(e.message);
              }
            }}
          >
            Agregar a mi calendario ↗
          </button>
        )}
      </section>
    </section>
  );
}

function ReminderPreview({ data, draft }) {
  const preview = {
      ...data,
      preferences: { ...draft, reminder: { ...draft.reminder, enabled: true } },
    },
    next = nextOccurrences(preview.preferences.reminder, new Date(), 3),
    goal = data.goals.find((g) => !g.archived && !isComplete(g)),
    sample = goal && next[0] ? composeMessage(preview, goal, next[0]) : null;
  return (
    <div className="reminder-preview">
      <p className="small-text">
        <strong>Próximos avisos:</strong>{" "}
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
