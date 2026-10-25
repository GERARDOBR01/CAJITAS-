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
  goalSummary,
  moneyPlace,
  PROVIDERS,
  SOURCE_LABEL,
} from "../domain.js";
import { RHYTHM_LABEL, rhythmLabel } from "../calendar.js";
import { isNative, openExternal } from "../platform.js";
import Money from "./Money.jsx";
import { ArrowRight, Backspace, CheckCircle, InfoCircle } from "./icons.jsx";
import { cleanAmount, nextAmount } from "../amount.js";
import Modal from "./Modal.jsx";
import { GoalComplete, GoalNotices, GoalProgress } from "./GoalProgress.jsx";

export const destinations = {
  Nu: "https://nu.com.mx/",
  "Mercado Pago": "https://www.mercadopago.com.mx/",
  BBVA: "https://www.bbva.mx/",
  Banorte: "https://www.banorte.com/",
  Santander: "https://www.santander.com.mx/",
  Banamex: "https://www.banamex.com/",
  "Hey Banco": "https://heybanco.com/",
  Klar: "https://www.klar.mx/",
  Bitso: "https://bitso.com/",
};
// A movement before this is surely a typo in the year.
const OLDEST_MOVEMENT = "2000-01-01";
const PROVIDER_OPTION = {
  Efectivo: "Efectivo o alcancía",
  Otra: "Otro banco o app",
};
export const symbols = { star: "✦", flower: "✿", cloud: "☁" };
export const dateLabel = (date) =>
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
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={draftPlan.amount}
            onChange={(e) =>
              setDraftPlan({
                ...draftPlan,
                amount: cleanAmount(e.target.value),
              })
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
              {PROVIDERS.map((name) => (
                <option key={name} value={name}>
                  {PROVIDER_OPTION[name] ?? name}
                </option>
              ))}
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
          donde lo guardas.
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
  goal: initialGoal,
  goals = [],
  withdraw,
  onSave,
  onClose,
  initialCents,
  onImport,
  weekday,
}) {
  const [goalId, setGoalId] = useState(initialGoal.id),
    [amount, setAmount] = useState(
      initialCents ? (initialCents / 100).toFixed(2) : "",
    ),
    [date, setDate] = useState(today()),
    [error, setError] = useState("");
  const choices = goals.some((g) => g.id === initialGoal.id)
      ? goals
      : [initialGoal, ...goals],
    goal = choices.find((g) => g.id === goalId) ?? initialGoal,
    step = plan(goal, goal.frequency, Date.now(), weekday) ?? 0,
    value = Number(amount) > 0 ? Math.round(Number(amount) * 100) : 0;
  function submit(e) {
    e.preventDefault();
    try {
      const value = cents(amount);
      if (withdraw && value > balance(goal))
        throw new Error("El retiro supera lo registrado en esta cajita.");
      if (!date || date > today() || date < OLDEST_MOVEMENT)
        throw new Error(
          "Elige la fecha en que ocurrió el movimiento, hasta hoy.",
        );
      const at =
        date === today()
          ? new Date().toISOString()
          : new Date(`${date}T12:00:00`).toISOString();
      onSave({ cents: withdraw ? -value : value, at, goalId: goal.id });
    } catch (err) {
      setError(err.message);
    }
  }
  return (
    <Modal
      sheet
      title={withdraw ? "Registrar retiro" : "Registrar ahorro"}
      subtitle={
        withdraw
          ? "Registra lo que usaste de tu ahorro en tu app externa. Usarlo cuando lo necesitas también es cumplir su propósito."
          : "Anota lo que apartaste en tu otra app o banco."
      }
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <label>
          ¿A qué cajita va?
          <select
            value={goal.id}
            onChange={(e) => {
              setGoalId(e.target.value);
              setError("");
            }}
          >
            {choices.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
        <div className="amount-box">
          <label className="amount-label">
            Monto (MXN)
            <span className="amount-field">
              <span aria-hidden="true">$</span>
              <input
                type="text"
                inputMode="none"
                autoComplete="off"
                placeholder="0"
                required
                autoFocus
                value={amount}
                onChange={(e) => setAmount(cleanAmount(e.target.value))}
              />
            </span>
          </label>
          {amount && (
            <button
              type="button"
              className="link-button"
              onClick={() => setAmount("")}
            >
              Borrar
            </button>
          )}
        </div>
        {!withdraw && (
          <div
            className="quick-amounts"
            role="group"
            aria-label="Montos rápidos"
          >
            {[5000, 10000, 20000].map((quick) => (
              <button
                type="button"
                key={quick}
                onClick={() => setAmount(String(quick / 100))}
              >
                {money(quick)}
              </button>
            ))}
            {step > 0 && (
              <button
                type="button"
                onClick={() => setAmount((step / 100).toFixed(2))}
              >
                Mi siguiente pasito
              </button>
            )}
          </div>
        )}
        {withdraw ? (
          <CommitmentNotice provider={goal.provider} />
        ) : (
          <p className="notice sheet-notice">
            <InfoCircle />
            <span>
              Tu dinero sigue disponible en {moneyPlace(goal.provider)}.
              Guardadito solo lleva el registro; no realiza transferencias.
            </span>
          </p>
        )}
        <div className="keypad" role="group" aria-label="Teclado numérico">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "back"].map(
            (key) => (
              <button
                type="button"
                key={key}
                aria-label={key === "back" ? "Borrar un dígito" : undefined}
                onClick={() => setAmount((current) => nextAmount(current, key))}
              >
                {key === "back" ? <Backspace /> : key}
              </button>
            ),
          )}
        </div>
        <label>
          Fecha del movimiento
          <input
            type="date"
            value={date}
            min={OLDEST_MOVEMENT}
            max={today()}
            required
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className={withdraw ? "secondary full" : "primary full"}>
          <CheckCircle />
          {withdraw ? "Retirar" : "Guardar"}
          {value > 0 && ` ${money(value)}`}
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
export function GoalCard({ goal, actions, onOpen, now }) {
  const summary = goalSummary(goal, now),
    { saved } = summary,
    guardian = actions.guardianFor(goal.id);
  return (
    <article className={`goal-card ${goal.icon}`}>
      <div className="goal-heading">
        <span className="goal-symbol">{symbols[goal.icon]}</span>
        <button
          className="goal-open"
          aria-label={`Ver detalle de ${goal.name}`}
          onClick={() => onOpen(goal.id)}
        >
          <h3>{goal.name}</h3>
          <span className="goal-meta">
            <span className={`provider ${goal.provider === "Nu" ? "nu" : ""}`}>
              {goal.provider === "Otra" ? "Mi banco" : goal.provider}
            </span>
            {goal.unlockDate
              ? `Meta: ${dateLabel(goal.unlockDate)}`
              : "A tu ritmo"}
          </span>
        </button>
        <p className="saved">
          <span className="visually-hidden">Ahorro registrado </span>
          <Money cents={saved} />
        </p>
        <button
          className="icon-button"
          aria-label={`Editar ${goal.name}`}
          onClick={() => actions.edit(goal)}
        >
          ⋯
        </button>
      </div>
      <GoalProgress goal={goal} summary={summary}>
        de {money(goal.targetCents)}
      </GoalProgress>
      <p className="remaining">
        {summary.complete
          ? "Ahorro registrado"
          : `Te faltan ${money(summary.remaining)}`}
      </p>
      <p className="goal-lock">
        <span aria-hidden="true">{summary.locked ? "♧" : "✓"}</span>
        {countdown(goal.unlockDate, now)}
      </p>
      <GoalNotices goal={goal} summary={summary} guardian={guardian} />
      <GoalComplete summary={summary} />
      {goal.archived ? (
        <button className="secondary full" onClick={() => actions.edit(goal)}>
          Recuperar cajita
        </button>
      ) : (
        <div className="card-actions">
          <button className="primary" onClick={() => actions.move(goal)}>
            + Registrar ahorro
          </button>
          <button
            className="secondary withdraw"
            disabled={!saved}
            onClick={() => actions.move(goal, { withdraw: true })}
          >
            Registrar retiro
          </button>
        </div>
      )}
      <GuardianActions goal={goal} guardian={guardian} saved={saved} />
      <button className="goal-more" onClick={() => onOpen(goal.id)}>
        Ver plan y movimientos
        {goal.entries.length > 0 && ` (${goal.entries.length})`}
        <ArrowRight />
      </button>
    </article>
  );
}

export function GuardianActions({ goal, guardian, saved }) {
  if (!guardian || goal.archived) return null;
  return (
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
  );
}
