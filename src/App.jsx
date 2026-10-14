import { useEffect, useRef, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import {
  STORAGE_KEY,
  money,
  today,
  cents,
  balance,
  countdown,
  plan,
  streak,
  initialData,
  validateBackup,
  addReceipt,
  estimate,
  unlockTime,
} from "./domain.js";

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
async function api(path, body) {
  const response = await fetch(
    `/api/${path}`,
    body === undefined
      ? {}
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
  );
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error ?? "No se pudo completar la consulta.");
  return data;
}
function Mascot({ progress = 0, sad = false, small = false }) {
  const growth = 0.8 + Math.min(1, progress) * 0.2;
  return (
    <svg
      className={`mascot ${small ? "small" : ""}`}
      viewBox="0 0 220 200"
      role="img"
      aria-label={
        sad
          ? "La mascota está triste y te acompaña"
          : "Caji, tu compañera de ahorro"
      }
    >
      <ellipse cx="111" cy="180" rx="66" ry="10" fill="#366959" opacity=".10" />
      <g transform={`translate(110 180) scale(${growth}) translate(-110 -180)`}>
        <path
          d="M68 146 61 176q9 9 22 0l9-26M132 149l10 27q12 7 23-1l-13-36"
          fill="#5f9380"
          stroke="#355c4a"
          strokeWidth="3"
        />
        <path
          d="M57 101Q28 106 28 126q7 14 16 0l24-5M162 103q33-3 31 24-9 12-15-3l-23-5"
          fill="#c1e1bc"
          stroke="#355c4a"
          strokeWidth="3"
        />
        <rect
          x="47"
          y="53"
          width="123"
          height="110"
          rx="33"
          fill="#c8e8bd"
          stroke="#355c4a"
          strokeWidth="3"
        />
        <path
          d="M48 83q60 17 122 0"
          fill="none"
          stroke="#355c4a"
          strokeWidth="3"
        />
        <rect
          x="39"
          y="47"
          width="139"
          height="37"
          rx="13"
          fill="#dff0c9"
          stroke="#355c4a"
          strokeWidth="3"
        />
        <path
          d="M91 56h40"
          stroke="#355c4a"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <path
          d="M109 46V28m0 8q-27 0-25-19 23-2 25 19m0-5q23 0 26-20-22-1-26 20"
          fill="#6ba382"
          stroke="#355c4a"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <ellipse cx="74" cy="121" rx="10" ry="6" fill="#efada9" />
        <ellipse cx="146" cy="121" rx="10" ry="6" fill="#efada9" />
        <circle cx="87" cy="109" r="4" fill="#355c4a" />
        <circle cx="133" cy="109" r="4" fill="#355c4a" />
        <path
          d={sad ? "M100 131q10-10 20 0" : "M100 123q10 12 20 0"}
          fill="none"
          stroke="#355c4a"
          strokeWidth="3"
          strokeLinecap="round"
        />
        {sad && <path d="M137 116q-7 9 0 12 7-3 0-12" fill="#80b7dd" />}
        <path
          d="m110 140 3 6 7 1-5 5 1 7-6-4-6 4 1-7-5-5 7-1Z"
          fill="#fff4b6"
        />
      </g>
      {!sad && (
        <>
          <path d="m183 39 3 8 8 3-8 3-3 8-3-8-8-3 8-3Z" fill="#e9bb61" />
          <path d="m24 66 2 5 5 2-5 2-2 5-2-5-5-2 5-2Z" fill="#e9bb61" />
        </>
      )}
    </svg>
  );
}
function Modal({ title, children, onClose }) {
  const ref = useRef();
  useEffect(() => {
    const previous = document.activeElement;
    ref.current.showModal();
    return () => previous?.focus();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <button className="icon-button" aria-label="Cerrar" onClick={onClose}>
          ×
        </button>
      </div>
      {children}
    </dialog>
  );
}
function GoalForm({ onSave, onClose }) {
  const [error, setError] = useState("");
  const [icon, setIcon] = useState("star");
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 30);
  function submit(e) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    try {
      const targetCents = cents(form.get("amount")),
        name = form.get("name").trim(),
        unlockDate = form.get("date");
      if (!name || unlockDate < today())
        throw new Error("Elige un nombre y una fecha de hoy en adelante.");
      onSave({
        id: crypto.randomUUID(),
        name,
        targetCents,
        unlockDate,
        provider: form.get("provider"),
        icon,
        entries: [],
      });
    } catch (err) {
      setError(err.message);
    }
  }
  return (
    <Modal title="Un nuevo sueño" onClose={onClose}>
      <p className="muted">Ponle nombre. Dale tiempo. Tú puedes.</p>
      <form onSubmit={submit}>
        <label>
          Nombre de tu meta
          <input
            name="name"
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
            placeholder="5000"
            required
          />
        </label>
        <div className="form-row">
          <label>
            Fecha de desbloqueo
            <input
              name="date"
              type="date"
              min={today()}
              defaultValue={tomorrow.toLocaleDateString("en-CA")}
              required
            />
          </label>
          <label>
            ¿Dónde lo guardas?
            <select name="provider">
              <option>Nu</option>
              <option>Mercado Pago</option>
              <option>Bitso</option>
              <option>Otra</option>
            </select>
          </label>
        </div>
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
        <button className="primary full">Crear cajita</button>
      </form>
    </Modal>
  );
}
function MovementForm({ goal, withdraw, onSave, onClose }) {
  const [amount, setAmount] = useState(""),
    [confirm, setConfirm] = useState(false),
    [error, setError] = useState("");
  const early = withdraw && unlockTime(goal.unlockDate) > Date.now();
  function submit(e) {
    e.preventDefault();
    try {
      const value = cents(amount);
      if (withdraw && value > balance(goal))
        throw new Error("El retiro supera lo registrado en esta cajita.");
      if (early && !confirm) {
        setConfirm(true);
        return;
      }
      onSave(withdraw ? -value : value);
    } catch (err) {
      setError(err.message);
    }
  }
  return (
    <Modal
      title={withdraw ? "Registrar un retiro" : "Un poquito más cerca"}
      onClose={onClose}
    >
      {confirm ? (
        <>
          <Mascot sad small />
          <p>Los planes cambian. Puedes ajustar tu meta y seguir después.</p>
          <p>
            Registrarás un retiro de <strong>{money(cents(amount))}</strong>{" "}
            antes del {dateLabel(goal.unlockDate)}.
          </p>
        </>
      ) : (
        <p className="muted">
          {withdraw
            ? "Registra lo que retiraste en tu app externa."
            : "Primero aparta el dinero en tu app externa; después regístralo aquí."}
        </p>
      )}
      <form onSubmit={submit}>
        {!confirm && (
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
        )}
        <p className="notice">
          Tu dinero sigue disponible en {goal.provider}. Cajitas solo lleva el
          registro; no realiza transferencias.
        </p>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className={withdraw ? "danger full" : "primary full"}>
          {confirm
            ? "Sí, registrar retiro"
            : withdraw
              ? "Continuar con el retiro"
              : "Registrar ahorro"}
        </button>
        {confirm && (
          <button type="button" className="secondary full" onClick={onClose}>
            Seguir ahorrando
          </button>
        )}
      </form>
    </Modal>
  );
}
function GoalCard({ goal, onMove, onEdit, now }) {
  const saved = balance(goal),
    progress = Math.min(1, saved / goal.targetCents);
  const [frequency, setFrequency] = useState(7);
  return (
    <article className={`goal-card ${goal.icon}`}>
      <div className="goal-heading">
        <span className="goal-symbol">{symbols[goal.icon]}</span>
        <span className={`provider ${goal.provider === "Nu" ? "nu" : ""}`}>
          {goal.provider}
        </span>
        <button
          className="icon-button"
          aria-label={`Ajustar fecha de ${goal.name}`}
          onClick={() => onEdit(goal)}
        >
          ⋯
        </button>
      </div>
      <h3>{goal.name}</h3>
      <p className="saved">
        {money(saved)} <span>de {money(goal.targetCents)}</span>
      </p>
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
        <span>Ahorro registrado</span>
        <strong>{Math.round(progress * 100)}%</strong>
      </div>
      <div className="lock">
        <span aria-hidden="true">
          {unlockTime(goal.unlockDate) > now ? "♧" : "✓"}
        </span>
        <div>
          <strong>{countdown(goal.unlockDate, now)}</strong>
          <span>Tu compromiso · {dateLabel(goal.unlockDate)}</span>
        </div>
      </div>
      {progress >= 1 ? (
        <p className="complete">✦ ¡Lo lograste! Tu esfuerzo floreció.</p>
      ) : (
        <div className="plan">
          <span>Tu siguiente pasito</span>
          <strong>{money(plan(goal, frequency, now))}</strong>
          <select
            aria-label={`Frecuencia de ${goal.name}`}
            value={frequency}
            onChange={(e) => setFrequency(Number(e.target.value))}
          >
            <option value={7}>por semana</option>
            <option value={15}>cada 15 días</option>
          </select>
        </div>
      )}
      <div className="card-actions">
        <button className="primary" onClick={() => onMove(goal, false)}>
          + Registrar ahorro
        </button>
        {destinations[goal.provider] ? (
          <a
            className="external"
            href={destinations[goal.provider]}
            target="_blank"
            rel="noopener noreferrer"
          >
            Ir a apartar ↗
          </a>
        ) : (
          <span className="muted small-text">Aparta en tu app</span>
        )}
      </div>
      <button
        className="text-button withdraw"
        disabled={!saved}
        onClick={() => onMove(goal, true)}
      >
        Registrar retiro
      </button>
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
                    {e.source === "gmail" ? "Correo" : "Manual"}
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
    </article>
  );
}
function Simulator() {
  const [rates, setRates] = useState(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [principal, setPrincipal] = useState("1000"),
    [rate, setRate] = useState(""),
    [days, setDays] = useState(28);
  async function refresh() {
    setLoading(true);
    setError("");
    try {
      setRates(await api("rates"));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    refresh();
  }, []);
  let amount = 0;
  try {
    amount = cents(principal);
  } catch {}
  const custom =
    rate !== "" &&
    Number.isFinite(Number(rate)) &&
    Number(rate) >= 0 &&
    Number(rate) <= 100;
  return (
    <section>
      <div className="section-heading">
        <div>
          <p className="eyebrow">HAZ LAS CUENTAS</p>
          <h1>Tu ahorro puede crecer</h1>
          <p className="muted">Compara tu tasa con referencias de Banxico.</p>
        </div>
      </div>
      <div className="simulator panel">
        <div className="form-row">
          <label>
            Monto inicial (MXN)
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={principal}
              onChange={(e) => setPrincipal(e.target.value)}
            />
          </label>
          <label>
            Plazo
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
            >
              <option value={28}>28 días</option>
              <option value={90}>90 días</option>
              <option value={180}>180 días</option>
              <option value={365}>365 días</option>
            </select>
          </label>
        </div>
        <label>
          Tasa anual de tu app (%)
          <input
            type="number"
            min="0"
            max="100"
            step="0.01"
            placeholder="Captura la tasa que ofrece tu app"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
          />
        </label>
        <div className="rate-grid">
          <div className="rate-card custom">
            <span>Tu tasa capturada</span>
            <strong>{custom ? `${rate}%` : "—"}</strong>
            <p>
              {custom && amount
                ? `${money(estimate(amount, Number(rate), days))} de rendimiento estimado`
                : "Captura una tasa para comparar."}
            </p>
          </div>
          {rates?.rates.map((r) => (
            <div className="rate-card" key={r.id}>
              <span>{r.label}</span>
              <strong>
                {r.available ? `${r.annualRate}%` : "No disponible"}
              </strong>
              <p>
                {r.available && amount
                  ? `${money(estimate(amount, r.annualRate, days))} de rendimiento estimado`
                  : "Sin dato publicado utilizable."}
              </p>
              <small>
                {r.id} · {r.date ?? "Sin fecha"}
              </small>
            </div>
          ))}
        </div>
        {loading && <p role="status">Consultando Banxico…</p>}
        {error && (
          <p className="notice" role="status">
            {error}
          </p>
        )}
        <button className="secondary" disabled={loading} onClick={refresh}>
          Actualizar tasas
        </button>
        <p className="small-text muted">
          Fuente: Banco de México · SIE.{" "}
          {rates &&
            `Consulta: ${new Date(rates.consultedAt).toLocaleString("es-MX")}.`}{" "}
          TIIE es una referencia interbancaria; no es un producto de ahorro.
        </p>
        <p className="notice">
          Estimación con interés simple: monto × tasa anual × días / 365. Tasa
          constante, antes de impuestos y comisiones, sin reinversión. Las
          condiciones de tu app pueden ser distintas; el rendimiento no está
          garantizado.
        </p>
      </div>
    </section>
  );
}
function Connections({ data, setData, notify, celebrate }) {
  const [status, setStatus] = useState({}),
    [busy, setBusy] = useState(false),
    [receipts, setReceipts] = useState([]),
    [pageToken, setPageToken] = useState(null),
    [balances, setBalances] = useState(null),
    [password, setPassword] = useState(""),
    [assign, setAssign] = useState({}),
    [remember, setRemember] = useState({});
  async function refresh() {
    try {
      setStatus(await api("status"));
    } catch (e) {
      notify(e.message);
    }
  }
  useEffect(() => {
    refresh();
  }, []);
  async function run(fn) {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      notify(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function sync(next = false) {
    const result = await api("gmail/sync", next ? { pageToken } : {});
    setPageToken(result.nextPageToken);
    let updated = data,
      automatic = 0,
      achieved = false;
    for (const receipt of result.receipts) {
      const goalId = updated.assignments[receipt.patternId],
        goal = updated.goals.find(
          (g) => g.id === goalId && g.provider === receipt.provider,
        );
      if (
        receipt.validated &&
        goal &&
        !updated.importedIds.includes(receipt.id)
      ) {
        const before = balance(goal);
        updated = addReceipt(updated, receipt, goalId);
        automatic++;
        if (
          before < goal.targetCents &&
          before + receipt.amountCents >= goal.targetCents
        )
          achieved = true;
      }
    }
    if (automatic && !setData(updated)) {
      updated = data;
      automatic = 0;
      achieved = false;
    }
    setReceipts((prev) => [
      ...new Map(
        [...(next ? prev : []), ...result.receipts]
          .filter((r) => !updated.importedIds.includes(r.id))
          .map((r) => [r.id, r]),
      ).values(),
    ]);
    if (achieved) celebrate();
    else
      notify(
        `Consulta lista. ${automatic} depósitos automáticos. ${result.ignored} correos sin patrón seguro; no se registraron.`,
      );
  }
  function accept(receipt) {
    const goalId =
      assign[receipt.id] ?? data.assignments[receipt.patternId] ?? "";
    const goal = data.goals.find((g) => g.id === goalId);
    if (!goal) {
      notify("Elige una cajita para este depósito.");
      return;
    }
    const next = addReceipt(data, receipt, goalId);
    if (remember[receipt.id])
      next.assignments = { ...next.assignments, [receipt.patternId]: goalId };
    if (!setData(next)) return;
    if (
      balance(goal) < goal.targetCents &&
      balance(next.goals.find((g) => g.id === goalId)) >= goal.targetCents
    )
      celebrate();
    setReceipts((prev) => prev.filter((r) => r.id !== receipt.id));
    notify("Depósito registrado una sola vez.");
  }
  return (
    <section>
      <div className="section-heading">
        <div>
          <p className="eyebrow">TODO EN SU LUGAR</p>
          <h1>Tus conexiones</h1>
          <p className="muted">Tú eliges qué conectar y cuándo consultar.</p>
        </div>
      </div>
      <div className="connection-grid">
        <article className="panel">
          <span className="connection-icon gmail">M</span>
          <h2>Comprobantes de Gmail</h2>
          <p>
            Busca confirmaciones de Nu y Mercado Pago de los últimos 90 días,
            filtradas por remitente.
          </p>
          <span className="badge">
            {status.gmailConnected
              ? "Conectado · solo lectura"
              : "Opcional · solo lectura"}
          </span>
          <p className="notice">
            Patrones de ejemplo pendientes de validar con correos reales
            anonimizados. Por ahora cada detección requiere tu revisión, incluso
            si recuerdas la cajita.
          </p>
          {status.gmailConnected ? (
            <div className="button-row">
              <button
                className="primary"
                disabled={busy}
                onClick={() => run(() => sync())}
              >
                Buscar depósitos
              </button>
              <button
                className="text-button"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await api("gmail/disconnect", {});
                    setReceipts([]);
                    await refresh();
                    notify("Gmail desconectado.");
                  })
                }
              >
                Desconectar
              </button>
            </div>
          ) : (
            <a
              className="primary button-link"
              href="/api/gmail/connect"
              onClick={(e) => {
                if (!status.gmailConfigured) {
                  e.preventDefault();
                  notify(
                    "Falta configurar Gmail OAuth y los remitentes exactos en el servidor.",
                  );
                }
              }}
            >
              Conectar Gmail ↗
            </a>
          )}
          <p className="small-text muted">
            El permiso gmail.readonly permite leer el correo. Cajitas filtra
            comprobantes y no guarda su contenido. La consulta se ejecuta cuando
            presionas el botón.
          </p>
        </article>
        <article className="panel">
          <span className="connection-icon bitso">↗</span>
          <h2>Saldo de Bitso</h2>
          <p>
            Consulta tu saldo actual con una llave que tenga únicamente el
            permiso “Ver balances”.
          </p>
          <span className="badge">Opcional · sin transferencias</span>
          {!status.bitsoAuthorized ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                run(async () => {
                  await api("bitso/login", { password });
                  setPassword("");
                  await refresh();
                  notify("Acceso a Bitso habilitado.");
                });
              }}
            >
              <label>
                Contraseña de acceso a esta conexión
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </label>
              <button
                className="secondary"
                disabled={busy || !status.bitsoConfigured}
              >
                Habilitar consulta
              </button>
              {!status.bitsoConfigured && (
                <p className="small-text muted">
                  Falta configurar la llave y el acceso del dueño en el
                  servidor.
                </p>
              )}
            </form>
          ) : (
            <div className="button-row">
              <button
                className="primary"
                disabled={busy}
                onClick={() =>
                  run(async () => setBalances(await api("bitso/balance")))
                }
              >
                Consultar saldo
              </button>
              <button
                className="text-button"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await api("bitso/logout", {});
                    setBalances(null);
                    await refresh();
                  })
                }
              >
                Cerrar acceso
              </button>
            </div>
          )}
          {balances && (
            <div className="balance-list">
              <h3>Saldo consultado en Bitso</h3>
              {balances.balances.map((b) => (
                <p key={b.currency}>
                  <strong>{b.currency.toUpperCase()}</strong>
                  <span>
                    {b.total} <small>disponible: {b.available}</small>
                  </span>
                </p>
              ))}
              <small>
                Actualizado:{" "}
                {new Date(balances.consultedAt).toLocaleString("es-MX")}
              </small>
              <p className="small-text muted">
                No se suma al ahorro registrado. Cada moneda conserva su unidad.
              </p>
            </div>
          )}
          <p className="small-text muted">
            La llave y su secreto se configuran en el servidor. Esta conexión es
            personal para el dueño de la instalación.
          </p>
        </article>
      </div>
      {receipts.length > 0 && (
        <div className="panel receipts">
          <h2>Depósitos por revisar</h2>
          {receipts.map((r) => (
            <article key={r.id}>
              <div>
                <strong>
                  {money(r.amountCents)} · {r.provider}
                </strong>
                <p className="small-text muted">
                  {new Date(r.at).toLocaleDateString("es-MX")} · patrón
                  pendiente de validar
                </p>
              </div>
              <label>
                Cajita
                <select
                  aria-label="Cajita"
                  value={assign[r.id] ?? data.assignments[r.patternId] ?? ""}
                  onChange={(e) =>
                    setAssign({ ...assign, [r.id]: e.target.value })
                  }
                >
                  <option value="">Selecciona una cajita</option>
                  {data.goals
                    .filter((g) => g.provider === r.provider)
                    .map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                </select>
              </label>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={remember[r.id] ?? false}
                  onChange={(e) =>
                    setRemember({ ...remember, [r.id]: e.target.checked })
                  }
                />
                Recordar esta cajita para el patrón
              </label>
              <div className="button-row">
                <button className="primary" onClick={() => accept(r)}>
                  Confirmar depósito
                </button>
                <button
                  className="text-button"
                  onClick={() => {
                    setData({
                      ...data,
                      importedIds: [...data.importedIds, r.id],
                    });
                    setReceipts((prev) => prev.filter((x) => x.id !== r.id));
                  }}
                >
                  Ignorar
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      {pageToken && (
        <button
          className="secondary"
          disabled={busy}
          onClick={() => run(() => sync(true))}
        >
          Consultar más comprobantes
        </button>
      )}
      {busy && <p role="status">Consultando de forma segura…</p>}
    </section>
  );
}
function Backup({ data, onRestore, notify }) {
  const [pending, setPending] = useState(null);
  function download() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `cajitas-${today()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    notify("Respaldo descargado. Guárdalo en un lugar privado.");
  }
  async function read(e) {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    try {
      if (file.size > 5e6)
        throw new Error("El respaldo debe pesar menos de 5 MB.");
      setPending(validateBackup(JSON.parse(await file.text())));
    } catch (err) {
      notify(
        err.message === "Unexpected end of JSON input"
          ? "El archivo está incompleto."
          : err.message,
      );
    }
  }
  return (
    <section>
      <div className="section-heading">
        <div>
          <p className="eyebrow">CUIDA TUS PASITOS</p>
          <h1>Tu respaldo</h1>
          <p className="muted">Lleva tus cajitas contigo.</p>
        </div>
      </div>
      <div className="panel backup-panel">
        <span className="backup-art">☁</span>
        <h2>Un lugar seguro para tus sueños</h2>
        <p>
          Tus metas y movimientos se guardan en este navegador. Descarga un
          respaldo antes de cambiar de dispositivo o borrar sus datos.
        </p>
        <div className="button-row">
          <button className="primary" onClick={download}>
            ↓ Descargar respaldo
          </button>
          <label className="secondary button-link">
            ↑ Importar respaldo
            <input
              className="visually-hidden"
              type="file"
              accept="application/json,.json"
              onChange={read}
            />
          </label>
        </div>
        <p className="small-text muted">
          Incluye metas, movimientos y correos ya revisados. No incluye
          contraseñas ni conexiones. El archivo contiene información de tu
          ahorro: guárdalo en privado.
        </p>
      </div>
      {pending && (
        <Modal title="Revisar respaldo" onClose={() => setPending(null)}>
          <p>
            Encontramos <strong>{pending.goals.length} cajitas</strong> con{" "}
            {money(pending.goals.reduce((s, g) => s + balance(g), 0))} de ahorro
            registrado.
          </p>
          <p className="notice">
            Al restaurarlo se reemplazarán las cajitas de este navegador.
            Descarga primero tu respaldo actual si quieres conservarlas.
          </p>
          <button
            className="primary full"
            onClick={() => {
              onRestore(pending);
              setPending(null);
            }}
          >
            Reemplazar con este respaldo
          </button>
          <button className="secondary full" onClick={() => setPending(null)}>
            Cancelar
          </button>
        </Modal>
      )}
    </section>
  );
}
export default function App() {
  const [loadError, setLoadError] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) validateBackup(JSON.parse(raw));
      return "";
    } catch {
      return "No se pudieron leer los datos guardados. Exporta o recupera un respaldo antes de registrar cambios.";
    }
  });
  const [data, setDataState] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? validateBackup(JSON.parse(raw)) : initialData();
    } catch {
      return initialData();
    }
  });
  const [tab, setTab] = useState("goals"),
    [modal, setModal] = useState(null),
    [toast, setToast] = useState(""),
    [now, setNow] = useState(Date.now()),
    [confetti, setConfetti] = useState(false),
    [sad, setSad] = useState(false),
    [offline, setOffline] = useState(!navigator.onLine);
  const toastTimer = useRef(),
    celebrationTimer = useRef(),
    sadTimer = useRef();
  const {
    offlineReady: [offlineReady],
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  function notify(message) {
    clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(""), 7000);
  }
  function setData(next, restoring = false) {
    if (loadError && !restoring) {
      notify(
        "Los datos guardados necesitan recuperación. Descarga los datos originales o importa un respaldo antes de continuar.",
      );
      return false;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setDataState(next);
      if (restoring) setLoadError("");
      return true;
    } catch {
      notify(
        "No pudimos guardar el cambio. Revisa el espacio o los permisos del navegador y descarga un respaldo.",
      );
      return false;
    }
  }
  function celebrate() {
    setSad(false);
    clearTimeout(sadTimer.current);
    clearTimeout(celebrationTimer.current);
    setConfetti(true);
    notify("¡Meta alcanzada! Poquito a poquito, lo lograste ✦");
    celebrationTimer.current = setTimeout(() => setConfetti(false), 5000);
  }
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    const on = () => setOffline(!navigator.onLine);
    window.addEventListener("online", on);
    window.addEventListener("offline", on);
    return () => {
      clearInterval(timer);
      window.removeEventListener("online", on);
      window.removeEventListener("offline", on);
      clearTimeout(toastTimer.current);
      clearTimeout(celebrationTimer.current);
      clearTimeout(sadTimer.current);
    };
  }, []);
  useEffect(() => {
    const gmail = new URLSearchParams(location.search).get("gmail");
    if (gmail) {
      setTab("connections");
      notify(
        gmail === "connected"
          ? "Gmail conectado. Ya puedes buscar comprobantes."
          : "Conexión cancelada.",
      );
      history.replaceState({}, "", location.pathname);
    }
  }, []);
  const total = data.goals.reduce((sum, g) => sum + balance(g), 0),
    target = data.goals.reduce((sum, g) => sum + g.targetCents, 0),
    completed = data.goals.filter((g) => balance(g) >= g.targetCents).length,
    racha = streak(data.goals);
  function movement(value) {
    const g = data.goals.find((g) => g.id === modal.goal.id);
    const next = {
      ...data,
      goals: data.goals.map((goal) =>
        goal.id === g.id
          ? {
              ...goal,
              entries: [
                ...goal.entries,
                {
                  id: crypto.randomUUID(),
                  cents: value,
                  at: new Date().toISOString(),
                  source: "manual",
                },
              ],
            }
          : goal,
      ),
    };
    if (!setData(next)) return;
    setModal(null);
    if (value < 0) {
      setSad(true);
      clearTimeout(sadTimer.current);
      sadTimer.current = setTimeout(() => setSad(false), 8000);
      notify("Retiro registrado. Los planes cambian; puedes seguir después.");
    } else if (
      balance(g) < g.targetCents &&
      balance(g) + value >= g.targetCents
    )
      celebrate();
    else notify("Ahorro registrado. ¡Un pasito más!");
  }
  const nav = [
    ["goals", "▦", "Mis cajitas"],
    ["simulator", "↗", "Rendimiento"],
    ["connections", "⌁", "Conexiones"],
    ["backup", "☁", "Respaldo"],
  ];
  return (
    <div className="app">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="Cajitas inicio">
          <span className="brand-icon">▣</span>cajitas
          <span className="brand-dot">✦</span>
        </a>
        <p className="brand-caption">Poquito a poquito.</p>
        <nav aria-label="Navegación principal">
          {nav.map(([key, icon, label]) => (
            <button
              key={key}
              className={tab === key ? "active" : ""}
              aria-current={tab === key ? "page" : undefined}
              onClick={() => {
                setTab(key);
                window.scrollTo({ top: 0 });
              }}
            >
              <span aria-hidden="true">{icon}</span>
              <span>{label}</span>
              {key === "goals" && <small>{data.goals.length}</small>}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <span>✿</span>
          <p>
            Los grandes sueños
            <br />
            empiezan con un
            <br />
            <strong>pequeño guardadito.</strong>
          </p>
        </div>
        <div className="local-badge">
          <span />
          Guardado en tu dispositivo
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span>UN SUEÑO A LA VEZ</span>
          <div className="topbar-right">
            <span className="private-badge">♧ Tu espacio personal</span>
            <span className="avatar" aria-hidden="true">
              ✿
            </span>
          </div>
        </header>
        <main>
          {(offline || offlineReady) && (
            <p className="offline" role="status">
              {offline
                ? "Estás sin conexión. Puedes registrar y respaldar tus cajitas; las consultas necesitan internet."
                : "Cajitas está lista para usarse sin conexión."}
            </p>
          )}
          {needRefresh && (
            <p className="offline">
              Hay una nueva versión.{" "}
              <button
                className="text-button"
                onClick={() => updateServiceWorker(true)}
              >
                Actualizar app
              </button>
            </p>
          )}
          {loadError && (
            <div className="error" role="alert">
              {loadError}
              <br />
              <button
                className="text-button"
                onClick={() => {
                  const raw = localStorage.getItem(STORAGE_KEY);
                  const url = URL.createObjectURL(
                    new Blob([raw ?? ""], { type: "application/json" }),
                  );
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "cajitas-datos-originales.json";
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                Descargar datos originales
              </button>
            </div>
          )}
          {tab === "goals" && (
            <>
              <div className="section-heading">
                <div>
                  <p className="eyebrow">TU FUTURO EMPIEZA AQUÍ</p>
                  <h1>
                    Un poquito hoy.
                    <br className="mobile-break" /> Un sueño mañana
                    <span className="heading-star"> ✦</span>
                  </h1>
                  <p className="muted">
                    Cada pasito cuenta. Dale una cajita a eso que tanto quieres.
                  </p>
                </div>
                <button
                  className="primary new-goal"
                  onClick={() => setModal({ type: "new" })}
                >
                  + Nueva cajita
                </button>
              </div>
              <section className="hero">
                <div className="hero-copy">
                  <span className="hero-pill">
                    ✦ {data.goals.length ? "VAS MUY BIEN" : "HOLA, SOY CAJI"}
                  </span>
                  <h2>
                    {sad
                      ? "Los planes cambian."
                      : data.goals.length
                        ? "Mira todo lo que llevas."
                        : "Los sueños también\nnecesitan una casita."}
                  </h2>
                  <p>
                    {sad
                      ? "Aquí seguimos. Puedes ajustar tu meta y empezar de nuevo."
                      : data.goals.length
                        ? "Tu constancia está haciendo crecer algo bonito. Sigue a tu ritmo."
                        : "Yo crezco contigo y con cada poquito que decides guardar."}
                  </p>
                  <div className="hero-total">
                    <span>Ahorro registrado</span>
                    <strong>
                      {money(total)} <small>MXN</small>
                    </strong>
                  </div>
                </div>
                <div className="hero-mascot">
                  <Mascot progress={target ? total / target : 0} sad={sad} />
                  <span className="mascot-caption">
                    tu compañera de ahorro ♡
                  </span>
                </div>
              </section>
              <div className="stats">
                <div>
                  <span className="stat-icon peach">♨</span>
                  <p>
                    <strong>
                      {racha} {racha === 1 ? "día" : "días"}
                    </strong>
                    <span>Racha de ahorro</span>
                  </p>
                </div>
                <div>
                  <span className="stat-icon lavender">▦</span>
                  <p>
                    <strong>
                      {data.goals.length}{" "}
                      {data.goals.length === 1 ? "cajita" : "cajitas"}
                    </strong>
                    <span>Sueños en camino</span>
                  </p>
                </div>
                <div>
                  <span className="stat-icon yellow">✦</span>
                  <p>
                    <strong>
                      {completed} {completed === 1 ? "meta" : "metas"}
                    </strong>
                    <span>Sueños cumplidos</span>
                  </p>
                </div>
              </div>
              <div className="goals-title">
                <h2>
                  Mis cajitas <span>{data.goals.length}</span>
                </h2>
                <span>Hechas con ilusión ♡</span>
              </div>
              {data.goals.length ? (
                <div className="goals-grid">
                  {data.goals.map((g) => (
                    <GoalCard
                      key={g.id}
                      goal={g}
                      now={now}
                      onMove={(goal, withdraw) =>
                        setModal({ type: "movement", goal, withdraw })
                      }
                      onEdit={(goal) => setModal({ type: "edit", goal })}
                    />
                  ))}
                  <button
                    className="add-card"
                    onClick={() => setModal({ type: "new" })}
                  >
                    <span>+</span>
                    <strong>Aquí cabe otro sueño</strong>
                    <small>Crear una nueva cajita</small>
                  </button>
                </div>
              ) : (
                <div className="empty-state">
                  <span className="empty-flower">✿</span>
                  <h3>¿Qué te hace ilusión?</h3>
                  <p>
                    Un viaje, ese curso, tu fondo de tranquilidad.
                    <br />
                    Tu primera cajita empieza contigo.
                  </p>
                  <button
                    className="secondary"
                    onClick={() => setModal({ type: "new" })}
                  >
                    Crear mi primera cajita ↗
                  </button>
                  <div className="dream-tags">
                    <span>☁ Una escapadita</span>
                    <span>✦ Mi guardadito</span>
                    <span>✿ Algo para mí</span>
                  </div>
                </div>
              )}
              <p className="commitment">
                <span>♧</span> El candado es de compromiso, no bancario. Tu
                dinero sigue disponible en la app externa.
              </p>
              <p className="streak-note">
                La racha cuenta días consecutivos con depósitos registrados;
                puedes continuar aunque un día no ahorres.
              </p>
            </>
          )}
          {tab === "simulator" && <Simulator />}
          {tab === "connections" && (
            <Connections
              data={data}
              setData={setData}
              notify={notify}
              celebrate={celebrate}
            />
          )}
          {tab === "backup" && (
            <Backup
              data={data}
              onRestore={(next) => {
                if (setData(next, true))
                  notify("Respaldo restaurado. Tus cajitas están aquí.");
              }}
              notify={notify}
            />
          )}
          <footer>
            <span>
              cajitas <span>✦</span>
            </span>
            <p>Cuida tus sueños. Ahorra a tu ritmo.</p>
            <small>Hecho para tus pequeños grandes planes.</small>
          </footer>
        </main>
      </div>
      {modal?.type === "new" && (
        <GoalForm
          onClose={() => setModal(null)}
          onSave={(goal) => {
            if (setData({ ...data, goals: [...data.goals, goal] })) {
              setModal(null);
              notify("Tu nueva cajita está lista.");
            }
          }}
        />
      )}{" "}
      {modal?.type === "movement" && (
        <MovementForm
          goal={data.goals.find((g) => g.id === modal.goal.id)}
          withdraw={modal.withdraw}
          onClose={() => setModal(null)}
          onSave={movement}
        />
      )}
      {modal?.type === "edit" && (
        <Modal title="Dale tiempo a tu sueño" onClose={() => setModal(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const date = new FormData(e.currentTarget).get("date");
              if (date < today()) return;
              if (
                setData({
                  ...data,
                  goals: data.goals.map((g) =>
                    g.id === modal.goal.id ? { ...g, unlockDate: date } : g,
                  ),
                })
              ) {
                setModal(null);
                notify("Fecha de compromiso ajustada.");
              }
            }}
          >
            <p className="muted">
              Si tu plan semanal se siente pesado, elige una fecha más adelante.
            </p>
            <label>
              Nueva fecha de desbloqueo
              <input
                type="date"
                name="date"
                min={today()}
                defaultValue={modal.goal.unlockDate}
                required
              />
            </label>
            <button className="primary full">Guardar fecha</button>
          </form>
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          {toast}
          <button aria-label="Cerrar aviso" onClick={() => setToast("")}>
            ×
          </button>
        </div>
      )}
      {confetti && (
        <div className="confetti" aria-label="Confeti por meta alcanzada">
          {Array.from({ length: 36 }, (_, i) => (
            <i
              key={i}
              style={{
                left: `${(i * 37) % 100}%`,
                background: ["#9fc9a7", "#e6aa93", "#c2b5dd", "#e9cf80"][i % 4],
                animationDelay: `${(i % 8) * 0.12}s`,
                transform: `rotate(${i * 17}deg)`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
