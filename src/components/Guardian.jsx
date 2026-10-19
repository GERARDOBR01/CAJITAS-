import { useState } from "react";
import { balance, cents, money } from "../domain.js";
import {
  cleanClabe,
  concept,
  formatClabe,
  validClabe,
} from "../cloud/deposits.js";
import Modal from "./Modal.jsx";

const METHOD = { spei: "Transferencia", cash: "En persona" };
const day = (ms) =>
  new Date(ms).toLocaleDateString("es-MX", { day: "numeric", month: "short" });

async function copy(text, label, notify) {
  try {
    await navigator.clipboard.writeText(text);
    notify(`${label} copiada.`);
  } catch {
    notify("No se pudo copiar; mantén presionado el texto para copiarlo.");
  }
}

/** The guardian writes where their partner can send the money. */
export function PayoutForm({ partner, name }) {
  const mine = partner.myPayout;
  const [editing, setEditing] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  if (mine && !editing)
    return (
      <div className="panel partner-panel">
        <h2>Guardas el ahorro de {name}</h2>
        <p className="held">
          <strong>{money(partner.held)}</strong>
          <small>confirmados por ti hasta hoy</small>
        </p>
        <p className="muted">
          {name} ve esta cuenta al depositar. Tú confirmas cada depósito cuando
          te llega.
        </p>
        <p className="clabe-line">
          <strong>{formatClabe(mine.clabe)}</strong>
          <small>
            {mine.holder} · {mine.bank}
          </small>
        </p>
        <div className="partner-actions">
          <button className="secondary" onClick={() => setEditing(true)}>
            Cambiar
          </button>
          <button
            className="text-button"
            onClick={() => partner.deletePayout().catch(() => {})}
          >
            Dejar de guardar
          </button>
        </div>
      </div>
    );
  return (
    <form
      className="panel partner-panel"
      aria-label="Guardar el ahorro de tu pareja"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        const clabe = cleanClabe(form.get("clabe"));
        if (!validClabe(clabe)) {
          setError("Revisa la CLABE: son 18 números y el último no cuadra.");
          return;
        }
        setError("");
        setBusy(true);
        try {
          await partner.savePayout({
            clabe,
            holder: String(form.get("holder")).trim(),
            bank: String(form.get("bank")).trim(),
          });
          setEditing(false);
        } catch {
          /* notified */
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>¿Guardas el ahorro de {name}?</h2>
      <p className="muted">
        Si {name} no tiene cuenta, puede mandarte su ahorro a ti. Tú confirmas
        cada depósito y Guardadito lleva la cuenta clara para los dos.
      </p>
      <label>
        Tu CLABE (18 números)
        <input
          name="clabe"
          inputMode="numeric"
          autoComplete="off"
          maxLength={24}
          defaultValue={mine?.clabe ?? ""}
          required
        />
      </label>
      <label>
        Nombre del titular
        <input
          name="holder"
          maxLength={60}
          defaultValue={mine?.holder ?? partner.myName}
          required
        />
      </label>
      <label>
        Banco o app
        <input
          name="bank"
          maxLength={40}
          defaultValue={mine?.bank ?? "Mercado Pago"}
          required
        />
      </label>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <p className="small-text muted">
        Solo {name} ve tu CLABE. Te sugerimos guardar su dinero en un apartado
        con su nombre.
      </p>
      <div className="partner-actions">
        <button className="primary" disabled={busy}>
          Guardar mi CLABE
        </button>
        {mine && (
          <button
            type="button"
            className="text-button"
            onClick={() => setEditing(false)}
          >
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}

/** What the partner says they sent or asks back, waiting for the guardian. */
export function DepositInbox({ partner, name }) {
  const [busy, setBusy] = useState("");
  if (!partner.toConfirm.length) return null;
  const decide = async (d, ok) => {
    setBusy(d.id);
    try {
      await partner.decide(d, ok);
    } catch {
      /* notified */
    } finally {
      setBusy("");
    }
  };
  return (
    <div className="panel partner-panel deposit-inbox">
      <h2>Por confirmar</h2>
      <ul className="partner-list" aria-label="Por confirmar">
        {partner.toConfirm.map((d) => (
          <li key={d.id}>
            <span>
              <strong>
                {d.cents > 0
                  ? `${name} te mandó ${money(d.cents)}`
                  : `${name} te pide ${money(-d.cents)}`}
              </strong>
              <small>
                {d.goalName} · {METHOD[d.method]} · {day(d.createdAt)}
              </small>
            </span>
            <span className="partner-actions">
              <button
                className="primary"
                disabled={busy === d.id}
                onClick={() => decide(d, true)}
              >
                {d.cents > 0
                  ? "Sí me llegó"
                  : d.method === "cash"
                    ? "Ya se lo di"
                    : "Ya se lo mandé"}
              </button>
              <button
                className="text-button"
                disabled={busy === d.id}
                onClick={() => decide(d, false)}
              >
                {d.cents > 0 ? "Aún no" : "Ahora no"}
              </button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** My notices still waiting for the guardian, or the ones they said no to. */
export function MyDeposits({ partner, name }) {
  if (!partner.myDeposits.length) return null;
  return (
    <div className="panel partner-panel">
      <h2>Tus avisos a {name}</h2>
      <ul className="partner-list" aria-label="Tus avisos">
        {partner.myDeposits.map((d) => (
          <li key={d.id}>
            <span>
              <strong>
                {d.cents > 0
                  ? `${money(d.cents)} a ${d.goalName}`
                  : `Retiro de ${money(-d.cents)} de ${d.goalName}`}
              </strong>
              <small>
                {d.status === "pending"
                  ? `⏳ Esperando a ${name}`
                  : d.cents > 0
                    ? `${name} aún no lo ve`
                    : `${name} dijo que ahora no`}
              </small>
            </span>
            <button
              className="text-button"
              onClick={() => partner.cancelDeposit(d.id).catch(() => {})}
            >
              {d.status === "pending" ? "Cancelar" : "Quitar"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Send savings to the guardian (or ask for them back) for one cajita. */
export function DepositDialog({
  goal,
  withdraw,
  guardian,
  name,
  pendingOut = 0,
  onSend,
  onClose,
  notify,
}) {
  const [step, setStep] = useState("amount"),
    [value, setValue] = useState(0),
    [method, setMethod] = useState("spei"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const available = balance(goal) - pendingOut;
  async function send(amount, how) {
    setBusy(true);
    try {
      await onSend(withdraw ? -amount : amount, how);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  if (step === "transfer")
    return (
      <Modal title={`Manda ${money(value)} a ${name}`} onClose={onClose}>
        <p className="muted">
          Desde tu banco o app, haz una transferencia SPEI con estos datos:
        </p>
        <dl className="transfer-data">
          <div>
            <dt>CLABE</dt>
            <dd>
              <code>{formatClabe(guardian.clabe)}</code>
              <button
                type="button"
                className="secondary"
                onClick={() => copy(guardian.clabe, "CLABE", notify)}
              >
                Copiar
              </button>
            </dd>
          </div>
          <div>
            <dt>Titular</dt>
            <dd>
              {guardian.holder} · {guardian.bank}
            </dd>
          </div>
          <div>
            <dt>Monto</dt>
            <dd>
              <code>{(value / 100).toFixed(2)}</code>
              <button
                type="button"
                className="secondary"
                onClick={() =>
                  copy((value / 100).toFixed(2), "Cantidad", notify)
                }
              >
                Copiar
              </button>
            </dd>
          </div>
          <div>
            <dt>Concepto</dt>
            <dd>
              <code>{concept(goal.name)}</code>
              <button
                type="button"
                className="secondary"
                onClick={() => copy(concept(goal.name), "Referencia", notify)}
              >
                Copiar
              </button>
            </dd>
          </div>
        </dl>
        <p className="notice">
          Cuenta en tu cajita cuando {name} confirme que le llegó.
        </p>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button
          className="primary full"
          disabled={busy}
          onClick={() => send(value, "spei")}
        >
          Ya lo mandé
        </button>
        <button className="text-button full" onClick={() => setStep("amount")}>
          Cambiar el monto
        </button>
      </Modal>
    );
  return (
    <Modal
      title={withdraw ? `Pedir a ${name}` : `Depositar con ${name}`}
      onClose={onClose}
    >
      <p className="muted">
        {withdraw
          ? `${name} te da el dinero de «${goal.name}» y lo confirma aquí. Tienes ${money(available)}.`
          : `${name} guarda tu ahorro de «${goal.name}» y lo confirma cuando le llega.`}
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          try {
            const amount = cents(String(form.get("amount")));
            if (withdraw && amount > available)
              throw new Error("Pides más de lo que tienes en esta cajita.");
            setError("");
            setValue(amount);
            if (!withdraw && method === "spei") setStep("transfer");
            else send(amount, method);
          } catch (err) {
            setError(err.message);
          }
        }}
      >
        <label>
          Monto (MXN)
          <input
            name="amount"
            type="number"
            min="0.01"
            step="0.01"
            defaultValue={value ? (value / 100).toFixed(2) : ""}
            required
            autoFocus
          />
        </label>
        <fieldset className="method-choice">
          <legend>{withdraw ? "¿Cómo te lo da?" : "¿Cómo se lo das?"}</legend>
          {Object.entries({
            spei: withdraw ? "Me lo transfiere" : "Por transferencia (SPEI)",
            cash: "En efectivo, en persona",
          }).map(([key, label]) => (
            <label key={key} className="radio">
              <input
                type="radio"
                name="method"
                value={key}
                checked={method === key}
                onChange={() => setMethod(key)}
              />
              {label}
            </label>
          ))}
        </fieldset>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="primary full" disabled={busy}>
          {withdraw
            ? "Pedir retiro"
            : method === "spei"
              ? "Ver a dónde mandarlo"
              : "Ya se lo di en persona"}
        </button>
      </form>
    </Modal>
  );
}
