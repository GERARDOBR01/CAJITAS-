import Money from "../components/Money.jsx";
import {
  GoalComplete,
  GoalNotices,
  GoalProgress,
} from "../components/GoalProgress.jsx";
import {
  GuardianActions,
  dateLabel,
  destinations,
  symbols,
} from "../components/Goals.jsx";
import {
  AddCircle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Calendar,
  MinusCircle,
  Pen,
} from "../components/icons.jsx";
import {
  SOURCE_LABEL,
  countdown,
  goalSummary,
  money,
  plan,
  projection,
} from "../domain.js";
import { RHYTHM_LABEL, rhythmLabel } from "../calendar.js";
import { isNative, openExternal } from "../platform.js";

const longDate = (date) => {
  const when = new Date(`${date}T12:00:00`),
    sameYear = when.getFullYear() === new Date().getFullYear();
  return when.toLocaleDateString("es-MX", {
    day: "numeric",
    month: "long",
    ...(sameYear ? {} : { year: "numeric" }),
  });
};

function Estimate({ goal, now }) {
  const guess = projection(goal, now);
  if (guess.kind === "done") return null;
  return (
    <div className="detail-estimate">
      <p className="eyebrow">Proyección estimada</p>
      {guess.kind === "pace" ? (
        <>
          <p>
            <strong>
              Llegarías a tu meta alrededor del {longDate(guess.date)}
            </strong>
          </p>
          <p className="small-text">
            Es un cálculo con tu ritmo de los últimos días, no una promesa.
            Cambia si ahorras más o menos.
          </p>
        </>
      ) : (
        <>
          <p>
            <strong>Aún no hay una estimación</strong>
          </p>
          <p className="small-text">
            Cuando registres tu ahorro unos días, aquí verás una fecha estimada.
          </p>
        </>
      )}
    </div>
  );
}

export default function GoalDetail({
  goal,
  now,
  weekday,
  actions,
  onBack,
  onFrequency,
  onActivity,
}) {
  const summary = goalSummary(goal, now),
    { saved } = summary,
    guardian = actions.guardianFor(goal.id),
    step = goal.unlockDate ? plan(goal, goal.frequency, now, weekday) : null,
    entries = goal.entries.slice().reverse().slice(0, 12);
  return (
    <section className="goal-detail" aria-label={`Detalle de ${goal.name}`}>
      <header className="detail-bar">
        <button
          className="round-button"
          aria-label="Volver a mis cajitas"
          onClick={onBack}
        >
          <ArrowLeft />
        </button>
        <button
          className="round-button"
          aria-label={`Editar ${goal.name}`}
          onClick={() => actions.edit(goal)}
        >
          <Pen />
        </button>
      </header>
      <div className={`detail-title ${goal.icon}`}>
        <span className="goal-symbol">{symbols[goal.icon]}</span>
        <div>
          <p>Cajita</p>
          <h1>{goal.name}</h1>
        </div>
      </div>
      <section className="detail-card">
        <p className="detail-label">Llevas ahorrado</p>
        <p className="detail-amount saved">
          <Money cents={saved} />
        </p>
        <p className="detail-sub">
          de tu meta de {money(goal.targetCents)}
          {goal.unlockDate && ` · ${longDate(goal.unlockDate)}`}
        </p>
        <GoalProgress goal={goal} summary={summary} thick>
          {summary.complete
            ? "Ahorro registrado"
            : `Faltan ${money(summary.remaining)}`}
        </GoalProgress>
      </section>
      <GoalComplete summary={summary} />
      {!summary.complete && (
        <section className="detail-plan">
          <h2>
            <Calendar /> Tu plan
          </h2>
          <p>
            {step === null ? (
              "Sin fecha objetivo: aporta lo que te acomode."
            ) : (
              <>
                Planeas apartar <strong>{money(step)}</strong>{" "}
                {rhythmLabel(goal.frequency)}.
              </>
            )}
          </p>
          <label className="plan-select">
            <span>Cada cuánto</span>
            <select
              aria-label={`Frecuencia de ${goal.name}`}
              value={goal.frequency}
              onChange={(e) => onFrequency(goal.id, Number(e.target.value))}
            >
              <option value={7}>{RHYTHM_LABEL.weekly}</option>
              <option value={15}>{RHYTHM_LABEL.biweekly}</option>
              <option value={30}>{RHYTHM_LABEL.monthly}</option>
            </select>
          </label>
          <Estimate goal={goal} now={now} />
        </section>
      )}
      <p className="goal-lock">
        <span aria-hidden="true">{summary.locked ? "♧" : "✓"}</span>
        {goal.unlockDate
          ? `${countdown(goal.unlockDate, now)} · ${dateLabel(goal.unlockDate)}`
          : "A tu ritmo, sin prisa"}
      </p>
      <GoalNotices goal={goal} summary={summary} guardian={guardian} />
      <GuardianActions goal={goal} guardian={guardian} saved={saved} />
      {!goal.archived &&
        (destinations[goal.provider] ? (
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
            Ir a apartar a {goal.provider} ↗
          </a>
        ) : (
          <span className="muted small-text">Aparta en tu app</span>
        ))}
      <div className="detail-section-head">
        <h2>Movimientos</h2>
        <button className="link-button" onClick={onActivity}>
          Ver en Actividad
        </button>
      </div>
      {entries.length ? (
        <ul className="detail-movements">
          {entries.map((e) => (
            <li key={e.id}>
              <span className={`move-icon ${e.cents > 0 ? "in" : "out"}`}>
                {e.cents > 0 ? <ArrowDown /> : <ArrowUp />}
              </span>
              <div>
                <strong>{e.cents > 0 ? "Depósito" : "Retiro"}</strong>
                <span>
                  {new Date(e.at).toLocaleDateString("es-MX", {
                    day: "numeric",
                    month: "short",
                  })}{" "}
                  · {SOURCE_LABEL[e.source] ?? "Manual"}
                </span>
              </div>
              <p className="saved">
                {e.cents > 0 ? "+" : ""}
                <Money cents={e.cents} />
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty-state">
          Aún no hay movimientos. Cuando registres lo que apartaste, aparecerá
          aquí.
        </p>
      )}
      {goal.archived ? (
        <div className="detail-actions">
          <button className="secondary full" onClick={() => actions.edit(goal)}>
            Recuperar cajita
          </button>
        </div>
      ) : (
        <div className="detail-actions">
          <button className="primary" onClick={() => actions.move(goal)}>
            <AddCircle /> Depositar
          </button>
          <button
            className="secondary"
            disabled={!saved}
            onClick={() => actions.move(goal, { withdraw: true })}
          >
            <MinusCircle /> Retirar
          </button>
        </div>
      )}
    </section>
  );
}
