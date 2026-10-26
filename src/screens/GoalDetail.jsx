import Money from "../components/Money.jsx";
import { GoalComplete, GoalNotices } from "../components/GoalProgress.jsx";
import { GuardianActions } from "../components/Goals.jsx";
import GoalIcon from "../goals/GoalIcon.jsx";
import { AddCircle, Pen } from "../components/icons.jsx";
import { dateText, goalSummary, moneyShort as money, plan } from "../domain.js";
import { rhythmLabel } from "../calendar.js";

const RHYTHMS = [
  [7, "Semana"],
  [15, "Quincena"],
  [30, "Mes"],
];
const longDate = (date) => {
  const when = new Date(`${date}T12:00:00`),
    sameYear = when.getFullYear() === new Date().getFullYear();
  return when.toLocaleDateString("es-MX", {
    day: "numeric",
    month: "long",
    ...(sameYear ? {} : { year: "numeric" }),
  });
};
const dayLabel = (at) =>
  new Date(at).toLocaleDateString("es-MX", { day: "numeric", month: "short" });

export default function GoalDetail({
  goal,
  now,
  weekday,
  actions,
  onFrequency,
  onActivity,
}) {
  const summary = goalSummary(goal, now),
    { saved } = summary,
    guardian = actions.guardianFor(goal.id),
    step = goal.unlockDate ? plan(goal, goal.frequency, now, weekday) : null,
    entries = goal.entries.slice().reverse();
  const shown = entries.slice(0, 8);
  return (
    <section className="goal-detail" aria-label={`Detalle de ${goal.name}`}>
      <header className="detail-head">
        <GoalIcon icon={goal.icon} size="lg" />
        <h1>{goal.name}</h1>
        <button
          className="icon-button"
          aria-label={`Editar ${goal.name}`}
          onClick={() => actions.edit(goal)}
        >
          <Pen />
        </button>
      </header>
      <section className="detail-card">
        <p className="detail-amount">
          <Money cents={saved} />
        </p>
        <p className="detail-sub">
          de {money(goal.targetCents)}
          {goal.unlockDate && ` · ${longDate(goal.unlockDate)}`}
        </p>
        <div
          className="progress thick"
          role="progressbar"
          aria-label={`Progreso de ${goal.name}`}
          aria-valuenow={summary.percent}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <span style={{ width: `${summary.progress * 100}%` }} />
        </div>
        <p className="progress-caption">
          <strong>{summary.percent} %</strong>
          <span>
            {summary.complete
              ? "¡Cumplida!"
              : `Faltan ${money(summary.remaining)}`}
          </span>
        </p>
      </section>
      <GoalComplete summary={summary} />
      {!summary.complete && !summary.pastDue && !goal.archived && (
        <section className="detail-plan" aria-label="Tu plan">
          <p>
            {step === null ? (
              "Sin prisa: guarda lo que puedas, cuando puedas."
            ) : (
              <>
                Tu pasito: <strong>{money(step)}</strong>{" "}
                {rhythmLabel(goal.frequency)}.{" "}
                <span className="muted">{dateText(goal.unlockDate, now)}.</span>
              </>
            )}
          </p>
          {step !== null && (
            <div
              className="chips"
              role="group"
              aria-label={`Frecuencia de ${goal.name}`}
            >
              {RHYTHMS.map(([days, label]) => (
                <button
                  key={days}
                  aria-pressed={goal.frequency === days}
                  onClick={() => onFrequency(goal.id, days)}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </section>
      )}
      <GoalNotices summary={summary} guardian={guardian} />
      {summary.pastDue && !goal.archived && (
        <button
          className="secondary full more-time"
          onClick={() => actions.giveMoreTime(goal)}
        >
          Darle 3 meses más
        </button>
      )}
      <GuardianActions goal={goal} guardian={guardian} saved={saved} />
      {goal.archived ? (
        <button
          className="secondary full"
          onClick={() => actions.toggleArchive(goal)}
        >
          Recuperar cajita
        </button>
      ) : (
        !summary.complete && (
          <button className="primary full" onClick={() => actions.move(goal)}>
            <AddCircle /> Guardar dinero
          </button>
        )
      )}
      <section aria-labelledby="moves-title">
        <h2 id="moves-title" className="detail-section-title">
          Movimientos
        </h2>
        {shown.length ? (
          <ul className="movement-list">
            {shown.map((e) => (
              <li key={e.id}>
                <span>
                  <strong>{e.cents > 0 ? "Guardaste" : "Usaste"}</strong>
                  <small>{dayLabel(e.at)}</small>
                </span>
                <strong className={e.cents > 0 ? "plus" : "minus"}>
                  {e.cents > 0 ? "+" : ""}
                  <Money cents={e.cents} />
                </strong>
                {e.source === "manual" && (
                  <button
                    className="edit-entry"
                    aria-label={`Corregir registro del ${new Date(e.at).toLocaleDateString("es-MX")}`}
                    onClick={() => actions.correct({ ...e, goalId: goal.id })}
                  >
                    <Pen />
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">Aquí aparecerá cada pasito.</p>
        )}
        {entries.length > shown.length && (
          <button className="text-button" onClick={onActivity}>
            Ver todo el historial
          </button>
        )}
      </section>
      {!goal.archived && saved > 0 && (
        <button
          className="text-button full"
          onClick={() => actions.move(goal, { withdraw: true })}
        >
          Usé parte de este ahorro
        </button>
      )}
    </section>
  );
}
