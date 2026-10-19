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
  SOURCE_LABEL,
} from "../domain.js";
import { RHYTHM_LABEL, rhythmLabel } from "../calendar.js";
import { isNative, openExternal } from "../platform.js";
import Illustration from "./Illustration.jsx";
import Money from "./Money.jsx";
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
export function GoalForm({ onSave, onClose, goal = null, onArchive, weekday }) {
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
    noDate: Boolean(goal && !goal.unlockDate),
  });
  let preview = null,
    openPreview = false;
  try {
    if (draftPlan.noDate) openPreview = cents(draftPlan.amount) > 0;
    else if (draftPlan.date >= today())
      preview = plan(
        {
          targetCents: cents(draftPlan.amount),
          unlockDate: draftPlan.date,
          entries: goal?.entries ?? [],
        },
        Number(draftPlan.frequency),
        Date.now(),
        weekday,
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
        unlockDate = draftPlan.noDate ? null : form.get("date");
      if (!name) throw new Error("Ponle un nombre a tu meta.");
      if (!draftPlan.noDate && !(unlockDate >= today()))
        throw new Error(
          "Elige una fecha objetivo de hoy en adelante, o marca Sin fecha.",
        );
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
          <div className="target-date">
            <label>
              Fecha objetivo
              <input
                name="date"
                type="date"
                min={today()}
                value={draftPlan.noDate ? "" : draftPlan.date}
                onChange={(e) =>
                  setDraftPlan({ ...draftPlan, date: e.target.value })
                }
                disabled={draftPlan.noDate}
                required={!draftPlan.noDate}
              />
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={draftPlan.noDate}
                onChange={(e) =>
                  setDraftPlan({ ...draftPlan, noDate: e.target.checked })
                }
              />
              Sin fecha
            </label>
          </div>
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
            <option value={7}>{RHYTHM_LABEL.weekly}</option>
            <option value={15}>{RHYTHM_LABEL.biweekly}</option>
            <option value={30}>{RHYTHM_LABEL.monthly}</option>
          </select>
        </label>
        {openPreview && (
          <div className="plan-preview" role="status">
            <span aria-hidden="true">🌱</span>
            <div>
              <strong>Sin fecha objetivo</strong>
              <p>
                Aporta lo que te acomode, a tu ritmo. Si después quieres una
                guía, ponle una fecha y te sugerimos un monto.
              </p>
            </div>
          </div>
        )}
        {preview !== null && (
          <div className="plan-preview" role="status">
            <span aria-hidden="true">🌱</span>
            <div>
              <strong>
                {money(preview)} {rhythmLabel(Number(draftPlan.frequency))}
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
  initialCents,
  onImport,
  weekday,
}) {
  const [amount, setAmount] = useState(
      initialCents ? (initialCents / 100).toFixed(2) : "",
    ),
    [date, setDate] = useState(today()),
    [error, setError] = useState("");
  function submit(e) {
    e.preventDefault();
    try {
      const value = cents(amount);
      if (withdraw && value > balance(goal))
        throw new Error("El retiro supera lo registrado en esta cajita.");
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
      <p className="muted">
        {withdraw
          ? "Registra lo que usaste de tu ahorro en tu app externa. Usarlo cuando lo necesitas también es cumplir su propósito."
          : "Primero aparta el dinero en tu app externa; después regístralo aquí."}
      </p>
      <form onSubmit={submit}>
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
            {(plan(goal, goal.frequency, Date.now(), weekday) ?? 0) > 0 && (
              <button
                type="button"
                onClick={() =>
                  setAmount(
                    (
                      plan(goal, goal.frequency, Date.now(), weekday) / 100
                    ).toFixed(2),
                  )
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
        <button className={withdraw ? "secondary full" : "primary full"}>
          {withdraw ? "Registrar retiro" : "Registrar ahorro"}
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
      </form>
    </Modal>
  );
}
export function GoalCard({
  goal,
  onMove,
  onEdit,
  now,
  onFrequency,
  weekday,
  guardian,
}) {
  const saved = balance(goal),
    progress = Math.min(1, saved / goal.targetCents);
  const frequency = goal.frequency;
  const status = goalStatus(goal, now);
  return (
    <article className={`goal-card ${goal.icon}`}>
      <div className="goal-heading">
        <span className="goal-symbol">{symbols[goal.icon]}</span>
        <div className="goal-title">
          <h3>{goal.name}</h3>
          <p className="goal-meta">
            <span className={`provider ${goal.provider === "Nu" ? "nu" : ""}`}>
              {goal.provider}
            </span>
            {goal.unlockDate
              ? `Meta: ${dateLabel(goal.unlockDate)}`
              : "A tu ritmo"}
          </p>
        </div>
        <p className="saved">
          <span className="visually-hidden">Ahorro registrado </span>
          <Money cents={saved} />
        </p>
        <button
          className="icon-button"
          aria-label={`Editar ${goal.name}`}
          onClick={() => onEdit(goal)}
        >
          ⋯
        </button>
      </div>
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
        <strong>{Math.round(progress * 100)}% logrado</strong>
        <span>de {money(goal.targetCents)}</span>
      </div>
      <p className="remaining">
        {status.complete
          ? "Ahorro registrado"
          : `Te faltan ${money(status.remaining)}`}
      </p>
      {guardian?.pending?.in > 0 && (
        <p className="on-the-way">
          ⏳ En camino: {money(guardian.pending.in)} · esperando a{" "}
          {guardian.name}
        </p>
      )}
      {guardian?.pending?.out > 0 && (
        <p className="on-the-way">
          ⏳ Pediste {money(guardian.pending.out)} a {guardian.name}
        </p>
      )}
      {progress >= 1 && (
        <div className="complete-scene">
          <Illustration kind="complete" />
          <p className="complete">✦ ¡Lo lograste! Tu esfuerzo floreció.</p>
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
        <div className="card-actions">
          <button className="primary" onClick={() => onMove(goal, false)}>
            + Registrar ahorro
          </button>
          <button
            className="secondary withdraw"
            disabled={!saved}
            onClick={() => onMove(goal, true)}
          >
            Registrar retiro
          </button>
        </div>
      )}
      {!goal.archived && guardian && (
        <div className="guardian-actions">
          <button
            className="secondary"
            onClick={() => guardian.onDeposit(goal, false)}
          >
            Depositar con {guardian.name}
          </button>
          <button
            className="text-button"
            disabled={saved - (guardian.pending?.out ?? 0) <= 0}
            onClick={() => guardian.onDeposit(goal, true)}
          >
            Pedir retiro a {guardian.name}
          </button>
        </div>
      )}
      <details className="goal-more">
        <summary>Plan, candado y movimientos</summary>
        <div className="lock">
          <span aria-hidden="true">
            {unlockTime(goal.unlockDate) > now ? "♧" : "✓"}
          </span>
          <div>
            <strong>{countdown(goal.unlockDate, now)}</strong>
            <span>
              {goal.unlockDate
                ? `Fecha objetivo · ${dateLabel(goal.unlockDate)}`
                : "A tu ritmo, sin prisa"}
            </span>
          </div>
        </div>
        <CommitmentNotice
          provider={goal.provider}
          keeper={
            guardian &&
            (guardian.pending ||
              goal.entries.some((e) => e.source === "guardian"))
              ? guardian.name
              : ""
          }
        />
        {progress < 1 && (
          <div className="plan">
            <span>Tu siguiente pasito</span>
            <strong>
              {goal.unlockDate
                ? money(plan(goal, frequency, now, weekday))
                : "A tu ritmo"}
            </strong>
            <select
              aria-label={`Frecuencia de ${goal.name}`}
              value={frequency}
              onChange={(e) => onFrequency(goal.id, Number(e.target.value))}
            >
              <option value={7}>{RHYTHM_LABEL.weekly}</option>
              <option value={15}>{RHYTHM_LABEL.biweekly}</option>
              <option value={30}>{RHYTHM_LABEL.monthly}</option>
            </select>
          </div>
        )}
        {!goal.archived && (
          <div className="card-actions">
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
        )}
        {!goal.archived && <></>}
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
                      {SOURCE_LABEL[e.source] ?? "Manual"}
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
      </details>
    </article>
  );
}
