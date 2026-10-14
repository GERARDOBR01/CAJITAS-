import { useState } from "react";
import Mascot from "./Mascot.jsx";
import {
  PETS,
  companionship,
  checkIn,
  today,
  balance,
  streak,
} from "../domain.js";
import {
  configureReminder,
  reminderCalendar,
  saveFile,
  isNative,
  haptic,
} from "../platform.js";
export default function PetRoom({ data, onSave, notify }) {
  const prefs = data.preferences,
    friend = companionship(data),
    [draft, setDraft] = useState(prefs),
    [saving, setSaving] = useState(false),
    [bubble, setBubble] = useState("");
  const checked = data.checkins.includes(today());
  async function save(e) {
    e.preventDefault();
    if (
      !draft.petName.trim() ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(draft.reminder.time)
    ) {
      notify("Elige un nombre y una hora válidos.");
      return;
    }
    setSaving(true);
    try {
      await configureReminder(draft.reminder);
      if (
        onSave({
          ...data,
          preferences: { ...draft, petName: draft.petName.trim() },
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
      unlocked: data.goals.some((g) => balance(g) >= g.targetCents),
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
          <p className="eyebrow">UNA AMISTAD QUE FLORECE</p>
          <h1>Tu pequeño gran compañero</h1>
          <p className="muted">
            Cuida tus hábitos. El dinero no mide tu amistad.
          </p>
        </div>
      </div>
      <div className="pet-room-layout">
        <div className="pet-garden panel">
          <span className="garden-cloud cloud-one">☁</span>
          <span className="garden-cloud cloud-two">☁</span>
          <span className="garden-flower flower-one">✿</span>
          <span className="garden-flower flower-two">✿</span>
          <span className="pet-level">
            Nivel {friend.level} · {friend.title}
          </span>
          <Mascot
            pet={draft.pet}
            name={draft.petName}
            accessory={draft.accessory}
            progress={friend.progress}
            interactive
            onPet={() => {
              haptic();
              setBubble("Un abrazo para ti. Gracias por venir ♡");
            }}
          />
          <h2>{draft.petName || PETS[draft.pet].name}</h2>
          <p className="pet-speech">{bubble || PETS[draft.pet].motto}</p>
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
            {Object.entries(PETS).map(([key, pet]) => (
              <button
                className={draft.pet === key ? "selected" : ""}
                type="button"
                key={key}
                aria-pressed={draft.pet === key}
                aria-label={`Elegir ${pet.label}`}
                onClick={() => choose(key)}
              >
                <Mascot pet={key} small accessory="leaf" />
                <strong>{pet.label}</strong>
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
        <h2>Un ratito para tus sueños</h2>
        <p className="muted">
          Un recordatorio semanal, sin presión ni movimientos automáticos.
        </p>
        <div className="form-row">
          <label>
            Día
            <select
              value={draft.reminder.day}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  reminder: { ...draft.reminder, day: Number(e.target.value) },
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
          <label>
            Hora
            <input
              type="time"
              value={draft.reminder.time}
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
        {isNative ? (
          <>
            <label className="checkbox">
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
              Recordarme en este dispositivo
            </label>
            <button
              className="secondary"
              disabled={saving}
              onClick={() => save({ preventDefault() {} })}
            >
              Guardar recordatorio
            </button>
            <p className="small-text muted">
              La entrega puede variar por batería y ajustes del teléfono. Los
              horarios usan la zona del dispositivo.
            </p>
          </>
        ) : (
          <>
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
            <p className="small-text muted">
              Descarga un evento semanal para importarlo en tu calendario.
              Cajitas no envía avisos desde el navegador cerrado.
            </p>
          </>
        )}
      </section>
    </section>
  );
}
