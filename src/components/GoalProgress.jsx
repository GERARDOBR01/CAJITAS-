import CommitmentNotice from "./CommitmentNotice.jsx";
import Illustration from "./Illustration.jsx";
import { money } from "../domain.js";

/** The progress bar of a cajita and its caption; `children` is the right
 * side of the caption. `summary` comes from `goalSummary`. */
export function GoalProgress({ goal, summary, thick = false, children }) {
  return (
    <>
      <div
        className={`progress${thick ? " thick" : ""}`}
        role="progressbar"
        aria-label={`Progreso de ${goal.name}`}
        aria-valuenow={summary.percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <span style={{ width: `${summary.progress * 100}%` }} />
      </div>
      <div className="progress-caption">
        <strong>{summary.percent}% logrado</strong>
        <span>{children}</span>
      </div>
    </>
  );
}

export function GoalComplete({ summary }) {
  if (!summary.complete) return null;
  return (
    <div className="complete-scene">
      <Illustration kind="complete" />
      <p className="complete">✦ ¡Lo lograste! Tu esfuerzo floreció.</p>
    </div>
  );
}

/** A date that already came, where the money really is and what is still
 * on its way through the guardian. */
export function GoalNotices({ goal, summary, guardian }) {
  return (
    <>
      {summary.pastDue && (
        <p className="past-due">
          Tu fecha ya llegó. Puedes ajustar el plan; tu sueño sigue aquí.
        </p>
      )}
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
    </>
  );
}
