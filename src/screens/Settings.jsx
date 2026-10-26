import { ANDROID_DOWNLOAD_URL, ANDROID_VERSION } from "../downloads.js";
import { isNative } from "../platform.js";
import { ownerTools } from "../features.js";
import { APP_VERSION } from "../support.js";
import { ClockCircle } from "../components/icons.jsx";

/** Everything that is not saving money, in one short list. */
export default function Settings({ cloud, data, onNavigate }) {
  const pet = data.preferences,
    reminder = pet.reminder;
  const items = [
    ["pet", "♡", "Mi mascota", `${pet.petName} y su detalle favorito`],
    [
      "reminder",
      <ClockCircle />,
      "Recordatorio",
      reminder.enabled ? "Activado" : "Apagado",
    ],
    ["history", "↺", "Historial", "Todo lo que has guardado y la papelera"],
    cloud?.configured && [
      "partner",
      "♥",
      "Ahorrar en pareja",
      "Cajitas de los dos",
    ],
    cloud?.configured && [
      "account",
      "☺",
      "Mi cuenta",
      cloud.user ? "Tus cajitas, en la nube" : "Para no perder tus cajitas",
    ],
    ["backup", "☁", "Respaldo", "Descarga o recupera tus cajitas"],
    !isNative && [
      "install",
      "↓",
      "Instalar",
      "Guardadito en tu pantalla de inicio",
    ],
    ["help", "?", "Ayuda", "Preguntas y cómo escribirnos"],
    ownerTools && [
      "simulator",
      "✦",
      "Rendimiento",
      "Compara tasas y haz tus cuentas",
    ],
    ownerTools && [
      "connections",
      "⌁",
      "Conexiones",
      "Importa y revisa tus comprobantes",
    ],
  ].filter(Boolean);
  return (
    <section className="settings" aria-labelledby="settings-title">
      <h1 id="settings-title">Ajustes</h1>
      <ul className="settings-list">
        {items.map(([key, icon, title, hint]) => (
          <li key={key}>
            <button onClick={() => onNavigate(key)}>
              <span className="settings-icon" aria-hidden="true">
                {icon}
              </span>
              <span>
                <strong>{title}</strong>
                <small>{hint}</small>
              </span>
              <span aria-hidden="true">›</span>
            </button>
          </li>
        ))}
      </ul>
      {!isNative && ownerTools && (
        <a className="secondary full" href={ANDROID_DOWNLOAD_URL}>
          ↓ APK para Android {ANDROID_VERSION}
        </a>
      )}
      <p className="settings-version">Guardadito {APP_VERSION}</p>
    </section>
  );
}
