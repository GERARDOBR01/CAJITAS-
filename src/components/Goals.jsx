import { useState } from "react";
import CommitmentNotice from "./CommitmentNotice.jsx";
import {
  money,
  today,
  cents,
  balance,
  countdown,
  plan,
  localDate,
  goalStatus,
  unlockTime,
} from "../domain.js";
import { isNative, openExternal } from "../platform.js";
import Mascot from "./Mascot.jsx";
import Illustration from "./Illustration.jsx";
import Modal from "./Modal.jsx";

const destinations = {
  Nu: "https://nu.com.mx/",
  "Mercado Pago": "https://www.mercadopago.com.mx/",
  Bitso: "https://bitso.com/",
};
const symbols = { star: "✦", flower: "✿", cloud: "☁" };
const dateLabel = (date) =>
  new Date(`${date}T12:00:00`).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
export function GoalForm({ onSave, onClose, goal = null, onArchive }) {
  const [error, setError] = useState("");
  const [icon, setIcon] = useState(goal?.icon ?? "star");
  const [template, setTemplate] = useState(null);
  const templates = [
    {
      id: "trip",
      name: "Una escapadita",
      icon: "cloud",
      label: "Una escapadita",
      symbol: "☁",
    },
    {
      id: "safety",
      name: "Mi colchoncito",
      icon: "star",
      label: "Tranquilidad",
      symbol: "✦",
    },
    {
      id: "treat",
      name: "Algo para mí",
      icon: "flower",
      label: "Algo para mí",
      symbol: "✿",
    },
  ];
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 30);
  const [draftPlan, setDraftPlan] = useState({
    amount: goal ? String(goal.targetCents / 100) : "",
    date: goal?.unlockDate ?? localDate(tomorrow),
    frequency: goal?.frequency ?? 7,
  });
  let preview = null;
  try {
    if (draftPlan.date >= today())
      preview = plan(
        {
          targetCents: cents(draftPlan.amount),
          unlockDate: draftPlan.date,
          entries: goal?.entries ?? [],
        },
        Number(draftPlan.frequency),
      );
  } catch {
    /* The preview appears once the amount is valid. */
  }
  function submit(e) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    try {
      const targetCents = cents(form.get("amount")),
        name = form.get("name").trim(),
        unlockDate = form.get("date");
      if (!name || unlockDate < today())
        throw new Error("Elige un nombre y una fecha de hoy en adelante.");
      onSave({
        ...goal,
        id: goal?.id ?? crypto.randomUUID(),
        name,
        targetCents,
        unlockDate,
        provider: form.get("provider"),
        icon,
        entries: goal?.entries ?? [],
        frequency: Number(form.get("frequency")),
        archived: goal?.archived ?? false,
      });
    } catch (err) {
      setError(err.message);
    }
  }
  return (
    <Modal
      title={goal ? "Tu sueño, a tu ritmo" : "Un nuevo sueño"}
      onClose={onClose}
    >
      <p className="muted">Ponle nombre. Dale tiempo. Tú puedes.</p>
      {!goal && (
        <div
          className="goal-templates"
          role="group"
          aria-label="Ideas para tu cajita"
        >
          {templates.map((t) => (
            <button
              type="button"
              key={t.id}
              aria-pressed={template?.id === t.id}
              onClick={() => {
                setTemplate(t);
                setIcon(t.icon);
              }}
            >
              <span>{t.symbol}</span>
              {t.label}
            </button>
          ))}
        </div>
      )}
      <form key={template?.id ?? goal?.id ?? "custom"} onSubmit={submit}>
        <label>
          Nombre de tu meta
          <input
            name="name"
            defaultValue={goal?.name ?? template?.name ?? ""}
            placeholder="Mi próxima aventura"
            maxLength={80}
            required
            autoFocus
          />
        </label>
        <label>
          ¿Cuánto quieres ahorrar? (MXN)
          <input
            name="amount"
            type="number"
            min="0.01"
            step="0.01"
            max="1000000000"
            value={draftPlan.amount}
            onChange={(e) =>
              setDraftPlan({ ...draftPlan, amount: e.target.value })
            }
            placeholder="5000"
            required
          />
        </label>
        <div className="form-row">
          <label>
            Fecha de desbloqueo
            <input
              name="date"
              type="date"
              min={today()}
              value={draftPlan.date}
              onChange={(e) =>
                setDraftPlan({ ...draftPlan, date: e.target.value })
              }
              required
            />
          </label>
          <label>
            ¿Dónde lo guardas?
            <select name="provider" defaultValue={goal?.provider ?? "Nu"}>
              <option>Nu</option>
              <option>Mercado Pago</option>
              <option>Bitso</option>
              <option>Otra</option>
            </select>
          </label>
        </div>
        <label>
          Mi ritmo de ahorro
          <select
            name="frequency"
            value={draftPlan.frequency}
            onChange={(e) =>
              setDraftPlan({ ...draftPlan, frequency: e.target.value })
            }
          >
            <option value={7}>Por semana</option>
            <option value={15}>Cada 15 días</option>
            <option value={30}>Cada 30 días</option>
          </select>
        </label>
        {preview !== null && (
          <div className="plan-preview" role="status">
            <span aria-hidden="true">🌱</span>
            <div>
              <strong>
                {money(preview)}{" "}
                {Number(draftPlan.frequency) === 7
                  ? "por semana"
                  : `cada ${draftPlan.frequency} días`}
              </strong>
              <p>
                Para llegar a tu meta. Si se siente pesado, cambia el monto o la
                fecha. Es una guía, no un cargo automático.
              </p>
            </div>
          </div>
        )}
        <fieldset>
          <legend>Elige su amuleto</legend>
          <div className="icon-options">
            {Object.entries(symbols).map(([key, symbol]) => (
              <button
                type="button"
                aria-label={`Amuleto ${key}`}
                aria-pressed={icon === key}
                className={icon === key ? "selected" : ""}
                key={key}
                onClick={() => setIcon(key)}
              >
                {symbol}
              </button>
            ))}
          </div>
        </fieldset>
        <p className="notice">
          El candado es de compromiso, no bancario. Tu dinero sigue disponible
          en la app externa.
        </p>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <button className="primary full">
          {goal ? "Guardar cambios" : "Crear cajita"}
        </button>
        {goal && (
          <button
            className="text-button full"
            type="button"
            onClick={() => onArchive(goal)}
          >
            {goal.archived ? "Volver a mis cajitas" : "Archivar cajita"}
          </button>
        )}
        {goal && (
          <p className="small-text muted">
            Archivar conserva tus movimientos y el ahorro registrado. Puedes
            recuperarla cuando quieras.
          </p>
        )}
      </form>
    </Modal>
  );
}
export function MovementForm({
  goal,
  withdraw,
  onSave,
  onClose,
  preferences,
  initialCents,
  onImport,
}) {
  const [amount, setAmount] = useState(
      initialCents ? (initialCents / 100).toFixed(2) : "",
    ),
    [date, setDate] = useState(today()),
    [confirm, setConfirm] = useState(false),
    [error, setError] = useState("");
  const early = withdraw && unlockTime(goal.unlockDate) > unlockTime(date);
  function submit(e) {
    e.preventDefault();
    try {
      const value = cents(amount);
      if (withdraw && value > balance(goal))
        throw new Error("El retiro supera lo registrado en esta cajita.");
      if (early && !confirm) {
        setConfirm(true);
        return;
      }
      if (!date || date > today())
        throw new Error(
          "Elige la fecha en que ocurrió el movimiento, hasta hoy.",
        );
      const at =
        date === today()
          ? new Date().toISOString()
          : new Date(`${date}T12:00:00`).toISOString();
      onSave({ cents: withdraw ? -value : value, at });
    } catch (err) {
      setError(err.message);
    }
  }
  return (
    <Modal
      title={withdraw ? "Registrar un retiro" : "Un poquito más cerca"}
      onClose={onClose}
    >
      {confirm ? (
        <>
          <Mascot
            sad
            small
            pet={preferences.pet}
            name={preferences.petName}
            accessory={preferences.accessory}
          />
          <p>Los planes cambian. Puedes ajustar tu meta y seguir después.</p>
          <p>
            Registrarás un retiro de <strong>{money(cents(amount))}</strong>{" "}
            antes del {dateLabel(goal.unlockDate)}.
          </p>
        </>
      ) : (
        <p className="muted">
          {withdraw
            ? "Registra lo que retiraste en tu app externa."
            : "Primero aparta el dinero en tu app externa; después regístralo aquí."}
        </p>
      )}
      <form onSubmit={submit}>
        {!confirm && (
          <>
            <label>
              Monto (MXN)
              <input
                type="number"
                min="0.01"
                step="0.01"
                required
                autoFocus
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>
            {!withdraw && (
              <div
                className="quick-amounts"
                role="group"
                aria-label="Montos rápidos"
              >
                {[5000, 10000, 20000].map((value) => (
                  <button
                    type="button"
                    key={value}
                    onClick={() => setAmount(String(value / 100))}
                  >
                    {money(value)}
                  </button>
                ))}
                {plan(goal, goal.frequency) > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      setAmount((plan(goal, goal.frequency) / 100).toFixed(2))
                    }
                  >
                    Mi siguiente pasito
                  </button>
                )}
              </div>
            )}
            <label>
              Fecha del movimiento
              <input
                type="date"
                value={date}
                max={today()}
                required
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
          </>
        )}
        {withdraw ? (
          <CommitmentNotice provider={goal.provider} />
        ) : (
          <p className="notice">
            Tu dinero sigue disponible en {goal.provider}. Guardadito solo lleva
            el registro; no realiza transferencias.
          </p>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className={withdraw ? "danger full" : "primary full"}>
          {confirm
            ? "Sí, registrar retiro"
            : withdraw
              ? "Continuar con el retiro"
              : "Registrar ahorro"}
        </button>
        {!withdraw && onImport && (
          <button
            type="button"
            className="text-button full"
            onClick={() => onImport(goal)}
          >
            Usar un correo de depósito
          </button>
        )}
        {confirm && (
          <button type="button" className="secondary full" onClick={onClose}>
            Seguir ahorrando
          </button>
        )}
      </form>
    </Modal>
  );
}
export function GoalCard({ goal, onMove, onEdit, now, onFrequency }) {
  const saved = balance(goal),
    progress = Math.min(1, saved / goal.targetCents);
  const frequency = goal.frequency;
  const status = goalStatus(goal, now);
  return (
    <article className={`goal-card ${goal.icon}`}>
      <div className="goal-heading">
        <span className="goal-symbol">{symbols[goal.icon]}</span>
        <span className={`provider ${goal.provider === "Nu" ? "nu" : ""}`}>
          {goal.provider}
        </span>
        <button
          className="icon-button"
          aria-label={`Editar ${goal.name}`}
          onClick={() => onEdit(goal)}
        >
          ⋯
        </button>
      </div>
      <h3>{goal.name}</h3>
      <span className="saved-label">Ahorro registrado</span>
      <p className="saved">
        {money(saved)} <span>de {money(goal.targetCents)}</span>
      </p>
      <div
        className="progress"
        role="progressbar"
        aria-label={`Progreso de ${goal.name}`}
        aria-valuenow={Math.round(progress * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <span style={{ width: `${progress * 100}%` }} />
      </div>
      <div className="progress-caption">
        <span>
          {status.complete
            ? "Ahorro registrado"
            : `Te faltan ${money(status.remaining)}`}
        </span>
        <strong>{Math.round(progress * 100)}%</strong>
      </div>
      <div className="lock">
        <span aria-hidden="true">
          {unlockTime(goal.unlockDate) > now ? "♧" : "✓"}
        </span>
        <div>
          <strong>{countdown(goal.unlockDate, now)}</strong>
          <span>Tu compromiso · {dateLabel(goal.unlockDate)}</span>
        </div>
      </div>
      <CommitmentNotice provider={goal.provider} />
      {progress >= 1 ? (
        <div className="complete-scene">
          <Illustration kind="complete" />
          <p className="complete">✦ ¡Lo lograste! Tu esfuerzo floreció.</p>
        </div>
      ) : (
        <div className="plan">
          <span>Tu siguiente pasito</span>
          <strong>{money(plan(goal, frequency, now))}</strong>
          <select
            aria-label={`Frecuencia de ${goal.name}`}
            value={frequency}
            onChange={(e) => onFrequency(goal.id, Number(e.target.value))}
          >
            <option value={7}>por semana</option>
            <option value={15}>cada 15 días</option>
            <option value={30}>cada 30 días</option>
          </select>
        </div>
      )}
      {status.pastDue && (
        <p className="past-due">
          Tu fecha ya llegó. Puedes ajustar el plan; tu sueño sigue aquí.
        </p>
      )}
      {goal.archived ? (
        <button className="secondary full" onClick={() => onEdit(goal)}>
          Recuperar cajita
        </button>
      ) : (
        <>
          <div className="card-actions">
            <button className="primary" onClick={() => onMove(goal, false)}>
              + Registrar ahorro
            </button>
            {destinations[goal.provider] ? (
              <a
                className="external"
                href={destinations[goal.provider]}
                onClick={
                  isNative
                    ? (e) => {
                        e.preventDefault();
                        openExternal(destinations[goal.provider]);
                      }
                    : undefined
                }
                target="_blank"
                rel="noopener noreferrer"
              >
                Ir a apartar ↗
              </a>
            ) : (
              <span className="muted small-text">Aparta en tu app</span>
            )}
          </div>
          <button
            className="text-button withdraw"
            disabled={!saved}
            onClick={() => onMove(goal, true)}
          >
            Registrar retiro
          </button>
        </>
      )}
      {goal.entries.length > 0 && (
        <details>
          <summary>Ver movimientos ({goal.entries.length})</summary>
          <ul className="movements">
            {goal.entries
              .slice()
              .reverse()
              .map((e) => (
                <li key={e.id}>
                  <span>
                    {new Date(e.at).toLocaleDateString("es-MX")} ·{" "}
                    {e.source === "gmail" ? "Correo" : "Manual"}
                  </span>
                  <strong>
                    {e.cents > 0 ? "+" : ""}
                    {money(e.cents)}
                  </strong>
                </li>
              ))}
          </ul>
        </details>
      )}
    </article>
  );
}
