import Illustration from "./Illustration.jsx";
import { money } from "../domain.js";

export function GoalComplete({ summary }) {
  if (!summary.complete) return null;
  return (
    <div className="complete-scene">
      <Illustration kind="complete" />
      <p className="complete">✦ ¡Lo lograste! Tu esfuerzo floreció.</p>
    </div>
  );
}

/** A date that already came, and what is still on its way through the
 * guardian. */
export function GoalNotices({ summary, guardian }) {
  return (
    <>
      {summary.pastDue && (
        <p className="past-due">
          Su fecha ya pasó. Puedes darle más tiempo; tu sueño sigue aquí.
        </p>
      )}
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
