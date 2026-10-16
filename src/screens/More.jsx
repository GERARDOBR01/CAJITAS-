import NextStep from "../components/NextStep.jsx";
import { ANDROID_DOWNLOAD_URL, ANDROID_VERSION } from "../downloads.js";
import { haptic, isNative } from "../platform.js";
import {
  activeGoals,
  balance,
  checkIn,
  companionship,
  streak,
  today,
} from "../domain.js";

export default function More({
  data,
  onSave,
  notify,
  onNavigate,
  onRecord,
  onEdit,
}) {
  const friend = companionship(data),
    active = activeGoals(data),
    nextGoal = active
      .filter((goal) => balance(goal) < goal.targetCents)
      .sort((a, b) => a.unlockDate.localeCompare(b.unlockDate))[0],
    completed = data.goals.filter(
      (goal) => balance(goal) >= goal.targetCents,
    ).length,
    racha = streak(data.goals),
    checked = data.checkins.includes(today());
  const counters = [
    [friend.days, "días de compañía"],
    [completed, "metas cumplidas"],
    [racha, "días de racha de ahorro"],
  ].filter(([value]) => value > 0);
  return (
    <section className="more-screen">
      <div className="section-heading">
        <div>
          <p className="eyebrow">TUS HERRAMIENTAS</p>
          <h1>Un poquito más de Guardadito</h1>
          <p className="muted">Elige por dónde seguimos.</p>
        </div>
      </div>
      <div className="more-grid">
        {[
          [
            "tutorial",
            "▷",
            "Tutorial interactivo",
            "Aprende jugando, con datos de ejemplo.",
          ],
          ["simulator", "✦", "Rendimiento", "Compara tasas y haz tus cuentas."],
          [
            "connections",
            "⌁",
            "Conexiones",
            "Importa y revisa tus comprobantes.",
          ],
          ["backup", "☁", "Respaldo", "Lleva tus cajitas contigo."],
          [
            "install",
            "↓",
            "Instalar app",
            "Guardadito en tu pantalla de inicio.",
          ],
        ].map(([key, icon, title, description]) => (
          <button
            className="panel more-card"
            key={key}
            aria-label={title}
            onClick={() => onNavigate(key)}
          >
            <span aria-hidden="true">{icon}</span>
            <span>
              <strong>{title}</strong>
              <small>{description}</small>
            </span>
            <span aria-hidden="true">→</span>
          </button>
        ))}
      </div>
      {!isNative && (
        <aside className="download-banner" aria-label="Descargar Guardadito">
          <span className="download-mascot" aria-hidden="true">
            🐷
          </span>
          <div>
            <strong>Lleva tus cajitas contigo</strong>
            <p>Android 7+ · versión {ANDROID_VERSION} · avisos de tu mascota</p>
            <p className="small-text">
              ¿Tenías la 0.5? Descarga un respaldo, desinstálala e instala esta;
              luego restaura tu respaldo.
            </p>
          </div>
          <a className="primary" href={ANDROID_DOWNLOAD_URL}>
            ↓ Descargar para Android
          </a>
        </aside>
      )}
      <section className="daily-ritual" aria-labelledby="ritual-title">
        <span className="ritual-icon" aria-hidden="true">
          ♡
        </span>
        <div>
          <h2 id="ritual-title">Un ratito para ti y tus sueños</h2>
          <p>
            {checked
              ? "Qué bonito verte hoy. Tu compañía ya cuenta."
              : `Visita a ${data.preferences.petName}, incluso sin ahorrar.`}
          </p>
        </div>
        <button
          className="secondary"
          disabled={checked}
          onClick={() => {
            if (onSave(checkIn(data))) {
              haptic();
              notify("Visita guardada. Tu ahorro registrado no cambió.");
            }
          }}
        >
          {checked ? "✓ Hoy nos vimos" : "Estoy aquí"}
        </button>
      </section>
      {counters.length > 0 && (
        <ul className="milestones" aria-label="Tus pasitos">
          {counters.map(([value, label]) => (
            <li key={label}>
              <strong>{value}</strong> {label}
            </li>
          ))}
        </ul>
      )}
      <NextStep goal={nextGoal} onRecord={onRecord} onEdit={onEdit} />
    </section>
  );
}
