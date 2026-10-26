import { useState } from "react";
import { cents, dateText, money, today } from "../domain.js";
import { cleanAmount } from "../amount.js";
import { contributions, myPart, myPlan } from "../cloud/shared.js";
import Modal from "./Modal.jsx";

function SharedGoalCard({
  goal,
  uid,
  partnerUid,
  partnerName,
  now,
  onMove,
  onEdit,
  onDelete,
}) {
  const by = contributions(goal),
    mine = by[uid] ?? 0,
    theirs = by[partnerUid] ?? 0,
    saved = mine + theirs,
    total = goal.targetCents;
  const part = myPart(goal, uid);
  const width = (value) =>
    `${Math.max(0, Math.min(100, (value / total) * 100))}%`;
  const step = myPlan(goal, uid, 15, now);
  return (
    <article className="goal-card shared-card">
      <div className="goal-heading">
        <span className="goal-symbol">💞</span>
        <span className="provider">En pareja</span>
        <button
          className="icon-button"
          aria-label={`Editar ${goal.name}`}
          onClick={() => onEdit(goal)}
        >
          ⋯
        </button>
      </div>
      <h3>{goal.name}</h3>
      <span className="saved-label">Ahorro de los dos</span>
      <p className="saved">
        {money(saved)} <span>de {money(total)}</span>
      </p>
      <div
        className="progress shared-progress"
        role="progressbar"
        aria-label={`Progreso de ${goal.name}`}
        aria-valuenow={Math.min(100, Math.round((saved / total) * 100))}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <span className="mine" style={{ width: width(mine) }} />
        <span className="theirs" style={{ width: width(theirs) }} />
      </div>
      <p className="shared-legend">
        <span>
          <i className="dot mine" /> Tú: {money(mine)}
        </span>
        <span>
          <i className="dot theirs" /> {partnerName}: {money(theirs)}
        </span>
      </p>
      <div className="plan">
        <span>Tu parte ({part.percent} %)</span>
        <strong>
          {part.remaining
            ? `Te faltan ${money(part.remaining)}`
            : "✓ Ya pusiste tu parte"}
        </strong>
        {step > 0 && part.remaining > 0 && (
          <small>Tu pasito: {money(step)} por quincena</small>
        )}
      </div>
      <p className="shared-date">{dateText(goal.unlockDate, now)}</p>
      {saved >= total && <p className="complete">✦ ¡Lo lograron juntos!</p>}
      <div className="card-actions">
        <button className="primary" onClick={() => onMove(goal, false)}>
          + Registrar mi aporte
        </button>
        <button
          className="text-button withdraw"
          disabled={!mine}
          onClick={() => onMove(goal, true)}
        >
          Usé parte
        </button>
      </div>
      <p className="small-text muted">
        Cada quien aparta su parte en su propio banco; aquí llevan la cuenta
        juntos.
      </p>
      {goal.entries.length > 0 && (
        <details>
          <summary>Ver aportes ({goal.entries.length})</summary>
          <ul className="movements">
            {goal.entries
              .slice()
              .reverse()
              .map((e) => (
                <li key={e.id}>
                  <span>
                    {new Date(e.at).toLocaleDateString("es-MX")} ·{" "}
                    {e.by === uid ? "Tú" : partnerName}
                    {e.note ? ` · ${e.note}` : ""}
                  </span>
                  <strong>
                    {e.cents > 0 ? "+" : ""}
                    {money(e.cents)}
                  </strong>
                  {e.by === uid && (
                    <button
                      className="text-button"
                      aria-label={`Borrar aporte de ${money(e.cents)}`}
                      onClick={() => onDelete(e)}
                    >
                      Borrar
                    </button>
                  )}
                </li>
              ))}
          </ul>
        </details>
      )}
    </article>
  );
}

function GoalForm({ goal, partnerName, onSave, onClose }) {
  const [busy, setBusy] = useState(false);
  const mine = goal ? undefined : 50;
  return (
    <Modal
      title={goal ? "Editar cajita en pareja" : "Nueva cajita en pareja"}
      onClose={onClose}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          setBusy(true);
          try {
            await onSave({
              id: goal?.id,
              name: String(form.get("name")).trim(),
              targetCents: cents(cleanAmount(String(form.get("amount")))),
              unlockDate: String(form.get("date") || ""),
              myPercent: Number(form.get("percent")),
              archived: false,
            });
            onClose();
          } catch {
            /* notified */
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          ¿Para qué ahorran juntos?
          <input
            name="name"
            maxLength={80}
            defaultValue={goal?.name ?? ""}
            placeholder="Nuestro viaje"
            required
            autoFocus
          />
        </label>
        <label>
          ¿Cuánto quieren juntar? (MXN)
          <input
            name="amount"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            defaultValue={goal ? goal.targetCents / 100 : ""}
            required
          />
        </label>
        <label>
          Fecha objetivo (opcional)
          <input
            name="date"
            type="date"
            defaultValue={goal?.unlockDate ?? ""}
          />
        </label>
        <label>
          Tu parte (%) · el resto lo pone {partnerName}
          <input
            name="percent"
            type="number"
            min="0"
            max="100"
            step="1"
            defaultValue={goal ? goal.myPercent : mine}
            required
          />
        </label>
        <button className="primary full" disabled={busy}>
          {goal ? "Guardar cambios" : "Crear cajita en pareja"}
        </button>
        {goal && (
          <button
            type="button"
            className="secondary full"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onSave({ ...goal, archived: true });
                onClose();
              } catch {
                /* notified */
              } finally {
                setBusy(false);
              }
            }}
          >
            Archivar cajita
          </button>
        )}
      </form>
    </Modal>
  );
}

function EntryForm({ goal, withdraw, onSave, onClose }) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      title={
        withdraw ? `Usé parte de ${goal.name}` : `Tu aporte a ${goal.name}`
      }
      onClose={onClose}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          setBusy(true);
          try {
            const value = cents(cleanAmount(String(form.get("amount"))));
            const day = String(form.get("date"));
            const at =
              day === today()
                ? new Date().toISOString()
                : new Date(`${day}T12:00:00`).toISOString();
            await onSave(
              goal,
              withdraw ? -value : value,
              at,
              String(form.get("note") ?? "").trim(),
            );
            onClose();
          } catch {
            /* notified */
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Monto (MXN)
          <input
            name="amount"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            required
            autoFocus
          />
        </label>
        <label>
          Fecha
          <input
            name="date"
            type="date"
            max={today()}
            defaultValue={today()}
            required
          />
        </label>
        <label>
          Nota (opcional)
          <input name="note" maxLength={200} />
        </label>
        <p className="notice">
          {withdraw
            ? "Usarlo cuando lo necesitas también es cumplir su propósito."
            : "Anota lo que ya apartaste en tu banco."}
        </p>
        <button className="primary full" disabled={busy}>
          {withdraw ? "Registrar" : "Registrar mi aporte"}
        </button>
      </form>
    </Modal>
  );
}

/** The cajitas a couple saves for together, on the home screen. */
export default function SharedGoals({ partner, uid, now, onCelebrate }) {
  const [modal, setModal] = useState(null);
  const name = partner.partnerName || "tu pareja";
  const goals = partner.shared.filter((g) => !g.archived);
  return (
    <section className="home-goals shared-goals" aria-labelledby="shared-title">
      <div className="goals-title">
        <h2 id="shared-title">En pareja 💞</h2>
        <span>Con {name}</span>
      </div>
      {goals.length ? (
        <div className="goals-grid">
          {goals.map((goal) => (
            <SharedGoalCard
              key={goal.id}
              goal={goal}
              uid={uid}
              partnerUid={partner.partnerUid}
              partnerName={name}
              now={now}
              onMove={(g, withdraw) =>
                setModal({ type: "entry", goal: g, withdraw })
              }
              onEdit={(g) =>
                setModal({
                  type: "goal",
                  goal: { ...g, myPercent: myPart(g, uid).percent },
                })
              }
              onDelete={(e) => partner.removeEntry(e.id).catch(() => {})}
            />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <p>Junten para algo de los dos: cada quien pone su parte.</p>
        </div>
      )}
      <button
        className="secondary new-goal"
        onClick={() => setModal({ type: "goal" })}
      >
        + Cajita en pareja
      </button>
      {modal?.type === "goal" && (
        <GoalForm
          goal={modal.goal}
          partnerName={name}
          onSave={(values) => partner.saveShared(values, modal.goal)}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === "entry" && (
        <EntryForm
          goal={modal.goal}
          withdraw={modal.withdraw}
          onSave={async (goal, value, at, note) => {
            const before = Object.values(contributions(goal)).reduce(
              (a, b) => a + b,
              0,
            );
            await partner.contribute(goal, value, at, note);
            if (
              value > 0 &&
              before < goal.targetCents &&
              before + value >= goal.targetCents
            )
              onCelebrate();
          }}
          onClose={() => setModal(null)}
        />
      )}
    </section>
  );
}
