import { useState } from "react";
import {
  moneyShort as money,
  today,
  cents,
  balance,
  plan,
  localDate,
  goalSummary,
  dateText,
} from "../domain.js";
import { rhythmLabel } from "../calendar.js";
import Money from "./Money.jsx";
import { Backspace, CheckCircle } from "./icons.jsx";
import { cleanAmount, nextAmount } from "../amount.js";
import Modal from "./Modal.jsx";
import GoalIcon, { ICON_CHOICES } from "../goals/GoalIcon.jsx";

// A movement before this is surely a typo in the year.
const OLDEST_MOVEMENT = "2000-01-01";
export const dateLabel = (date) =>
  new Date(`${date}T12:00:00`).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

const RHYTHMS = [
  [7, "Cada semana"],
  [15, "Cada quincena"],
  [30, "Cada mes"],
];
/** Ready-made answers to "¿para cuándo?", in months from today. */
const WHEN = [
  [0, "Sin prisa"],
  [3, "3 meses"],
  [6, "6 meses"],
  [12, "1 año"],
];
function monthsFromToday(months) {
  const date = new Date();
  date.setMonth(date.getMonth() + months);
  return localDate(date);
}
/** Which "¿para cuándo?" chip a date matches, or "date" for any other. */
function whenOf(date) {
  if (!date) return 0;
  const match = WHEN.find(
    ([months]) => months && monthsFromToday(months) === date,
  );
  return match ? match[0] : "date";
}

export function GoalForm({
  onSave,
  onClose,
  goal = null,
  onArchive,
  weekday,
  idea = null,
}) {
  const [error, setError] = useState(""),
    [name, setName] = useState(goal?.name ?? idea?.name ?? ""),
    [icon, setIcon] = useState(goal?.icon ?? idea?.icon ?? "star"),
    [amount, setAmount] = useState(goal ? String(goal.targetCents / 100) : ""),
    [when, setWhen] = useState(goal ? whenOf(goal.unlockDate) : 6),
    [date, setDate] = useState(goal?.unlockDate ?? monthsFromToday(6)),
    [frequency, setFrequency] = useState(goal?.frequency ?? 15);
  const unlockDate =
    when === 0 ? null : when === "date" ? date : monthsFromToday(when);
  let step = null;
  try {
    if (unlockDate && unlockDate >= today())
      step = plan(
        {
          targetCents: cents(amount),
          unlockDate,
          entries: goal?.entries ?? [],
        },
        frequency,
        Date.now(),
        weekday,
      );
  } catch {
    /* The suggestion appears once the amount is valid. */
  }
  function submit(e) {
    e.preventDefault();
    try {
      const targetCents = cents(amount),
        clean = name.trim();
      if (!clean) throw new Error("Ponle un nombre a tu cajita.");
      if (unlockDate && !(unlockDate >= today()))
        throw new Error("Elige una fecha de hoy en adelante, o «Sin prisa».");
      onSave({
        ...goal,
        id: goal?.id ?? crypto.randomUUID(),
        name: clean,
        targetCents,
        unlockDate,
        provider: goal?.provider ?? "Otra",
        icon,
        entries: goal?.entries ?? [],
        frequency,
        archived: goal?.archived ?? false,
      });
    } catch (err) {
      setError(err.message);
    }
  }
  return (
    <Modal title={goal ? "Editar cajita" : "Nueva cajita"} onClose={onClose}>
      <form className="goal-form" onSubmit={submit}>
        <label>
          ¿Para qué es?
          <input
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Unos tenis, un viaje…"
            maxLength={80}
            required
            autoFocus={!goal && !idea}
          />
        </label>
        <div className="icon-row" role="group" aria-label="Ícono de la cajita">
          {ICON_CHOICES.map(([key, label]) => (
            <button
              type="button"
              key={key}
              aria-label={label}
              aria-pressed={icon === key}
              onClick={() => setIcon(key)}
            >
              <GoalIcon icon={key} size="sm" />
            </button>
          ))}
        </div>
        <label>
          ¿Cuánto quieres juntar?
          <span className="money-input">
            <span aria-hidden="true">$</span>
            <input
              name="amount"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={amount}
              onChange={(e) => setAmount(cleanAmount(e.target.value))}
              placeholder="5,000"
              required
              autoFocus={Boolean(idea) && !goal}
            />
          </span>
        </label>
        <fieldset className="chips">
          <legend>¿Para cuándo?</legend>
          {WHEN.map(([months, label]) => (
            <button
              type="button"
              key={months}
              aria-pressed={when === months}
              onClick={() => setWhen(months)}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            aria-pressed={when === "date"}
            onClick={() => setWhen("date")}
          >
            Otra fecha
          </button>
        </fieldset>
        {when === "date" && (
          <label>
            Fecha
            <input
              name="date"
              type="date"
              min={today()}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </label>
        )}
        {unlockDate && (
          <fieldset className="chips">
            <legend>¿Cada cuánto apartas?</legend>
            {RHYTHMS.map(([days, label]) => (
              <button
                type="button"
                key={days}
                aria-pressed={frequency === days}
                onClick={() => setFrequency(days)}
              >
                {label}
              </button>
            ))}
          </fieldset>
        )}
        <p className="plan-line" role="status">
          {unlockDate
            ? step !== null && (
                <>
                  Serían <strong>{money(step)}</strong> {rhythmLabel(frequency)}
                  .
                </>
              )
            : "Guarda lo que puedas, cuando puedas."}
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
      </form>
    </Modal>
  );
}

const QUICK = [2000, 5000, 10000];

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
    [otherDay, setOtherDay] = useState(false),
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
        throw new Error("Es más de lo que llevas en esta cajita.");
      if (!date || date > today() || date < OLDEST_MOVEMENT)
        throw new Error("Elige una fecha de hasta hoy.");
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
      title={withdraw ? "Usé parte de mi ahorro" : "Guardar dinero"}
      subtitle={
        withdraw
          ? "Usarlo cuando lo necesitas también es cumplir su propósito."
          : undefined
      }
      onClose={onClose}
    >
      <form className="save-sheet" onSubmit={submit}>
        {choices.length > 1 &&
          (choices.length <= 4 ? (
            <div className="goal-chips" role="radiogroup" aria-label="Cajita">
              {choices.map((g) => (
                <button
                  type="button"
                  role="radio"
                  key={g.id}
                  aria-checked={g.id === goal.id}
                  onClick={() => {
                    setGoalId(g.id);
                    setError("");
                  }}
                >
                  <GoalIcon icon={g.icon} size="xs" />
                  {g.name}
                </button>
              ))}
            </div>
          ) : (
            <label>
              Cajita
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
          ))}
        <label className="amount-display">
          <span aria-hidden="true">$</span>
          <input
            aria-label="Monto"
            type="text"
            inputMode="none"
            autoComplete="off"
            placeholder="0"
            required
            value={amount}
            onChange={(e) => setAmount(cleanAmount(e.target.value))}
          />
        </label>
        {!withdraw && (
          <div className="chips quick" role="group" aria-label="Montos rápidos">
            {QUICK.map((quick) => (
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
                Mi pasito {money(step)}
              </button>
            )}
          </div>
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
        {otherDay ? (
          <label>
            ¿Qué día fue?
            <input
              type="date"
              value={date}
              min={OLDEST_MOVEMENT}
              max={today()}
              required
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
        ) : (
          <button
            type="button"
            className="text-button"
            onClick={() => setOtherDay(true)}
          >
            ¿Fue otro día?
          </button>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className={withdraw ? "secondary full" : "primary full"}>
          <CheckCircle />
          {withdraw ? "Registrar" : "Guardar"}
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

/** A cajita on the home screen: tap it to see it, + to save in it. */
export function GoalCard({ goal, actions, onOpen, now }) {
  const summary = goalSummary(goal, now),
    open = !goal.archived && !summary.complete;
  return (
    <article className="cajita">
      <button
        className="cajita-open"
        aria-label={`Ver detalle de ${goal.name}`}
        onClick={() => onOpen(goal.id)}
      >
        <GoalIcon icon={goal.icon} />
        <span className="cajita-text">
          <strong>{goal.name}</strong>
          <small>
            {goal.archived
              ? "Archivada"
              : summary.complete
                ? "¡Cumplida! 🎉"
                : dateText(goal.unlockDate, now)}
          </small>
        </span>
        <span className="cajita-amount">
          <Money cents={summary.saved} />
          <small>de {money(goal.targetCents)}</small>
        </span>
      </button>
      <div className="cajita-progress">
        <div
          className="progress"
          role="progressbar"
          aria-label={`Progreso de ${goal.name}`}
          aria-valuenow={summary.percent}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <span style={{ width: `${summary.progress * 100}%` }} />
        </div>
        <span className="cajita-percent">{summary.percent} %</span>
        {open && (
          <button
            className="cajita-add"
            aria-label={`Guardar en ${goal.name}`}
            onClick={() => actions.move(goal)}
          >
            +
          </button>
        )}
      </div>
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
