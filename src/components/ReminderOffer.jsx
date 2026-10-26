import { useState } from "react";
import { allowReminders } from "../reminders/device.js";

const OFFERED_KEY = "guardadito:reminder-offer";

function offered() {
  try {
    return localStorage.getItem(OFFERED_KEY) === "1";
  } catch {
    return false;
  }
}

/** After the first saving, once: a weekly reminder in one tap. */
export function wantsReminderOffer(data) {
  return (
    !data.preferences.reminder.enabled &&
    data.goals.some((g) => g.entries.some((e) => e.cents > 0)) &&
    !offered()
  );
}

export default function ReminderOffer({ data, onSave, notify }) {
  const [hidden, setHidden] = useState(false);
  if (hidden || !wantsReminderOffer(data)) return null;
  const pet = data.preferences;
  function done() {
    setHidden(true);
    try {
      localStorage.setItem(OFFERED_KEY, "1");
    } catch {
      /* It may ask once more; nothing else depends on it. */
    }
  }
  async function accept() {
    try {
      await allowReminders();
      const reminder = {
        ...pet.reminder,
        enabled: true,
        frequency: "weekly",
        day: 5,
        time: "09:00",
        since: new Date().toISOString(),
        ignored: 0,
      };
      if (onSave({ ...data, preferences: { ...pet, reminder } }))
        notify(`Listo. ${pet.petName} te escribe los viernes a las 9.`);
      done();
    } catch (error) {
      notify(error.message);
    }
  }
  return (
    <aside className="account-nudge" aria-label="Recordatorio semanal">
      <span aria-hidden="true">⏰</span>
      <div>
        <strong>¿Te recuerdo guardar cada viernes?</strong>
        <p>
          {pet.petName} te pregunta cuánto apartaste. Sin presión; lo cambias en
          Ajustes.
        </p>
        <div className="button-row">
          <button className="primary" onClick={accept}>
            Sí, recuérdame
          </button>
          <button className="text-button" onClick={done}>
            Ahora no
          </button>
        </div>
      </div>
    </aside>
  );
}
