import { goalSummary, money, plan } from "../domain.js";
import { rhythmLabel } from "../calendar.js";
import Illustration from "./Illustration.jsx";

export default function NextStep({ goal, onRecord, onEdit, weekday }) {
  if (!goal) return null;
  const status = goalSummary(goal),
    amount = plan(goal, goal.frequency, Date.now(), weekday);
  return (
    <aside className="next-step" aria-label="Tu siguiente pasito">
      <Illustration kind="path" />
      <div>
        <p className="eyebrow">UN PASITO A LA VEZ</p>
        <h2>{status.pastDue ? "Ajustemos tu plan" : goal.name}</h2>
        <p>
          {status.pastDue ? (
            `La fecha de ${goal.name} ya llegó. Puedes cambiarla y seguir a tu ritmo.`
          ) : amount === null ? (
            "Sin fecha objetivo: aporta lo que te acomode. Si ya lo apartaste, regístralo aquí."
          ) : (
            <>
              <strong>{money(amount)}</strong> {rhythmLabel(goal.frequency)}. Si
              ya lo apartaste, regístralo aquí.
            </>
          )}
        </p>
      </div>
      <button
        className={status.pastDue ? "secondary" : "primary"}
        onClick={() =>
          status.pastDue ? onEdit(goal) : onRecord(goal, amount ?? undefined)
        }
      >
        {status.pastDue ? "Revisar mi plan" : "Registrar mi pasito"}
      </button>
    </aside>
  );
}
