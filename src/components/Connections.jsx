import { useEffect, useState } from "react";
import { api, connectGmail } from "../platform.js";
import {
  addReceipt,
  balance,
  money,
  possibleReceiptMatches,
  reconcileReceipt,
} from "../domain.js";
import LocalMailImport from "./LocalMailImport.jsx";

export default function Connections({
  data,
  setData,
  notify,
  celebrate,
  onCreate,
}) {
  const [status, setStatus] = useState({}),
    [statusError, setStatusError] = useState(""),
    [busy, setBusy] = useState(false),
    [receipts, setReceipts] = useState([]),
    [pageToken, setPageToken] = useState(null),
    [balances, setBalances] = useState(null),
    [password, setPassword] = useState(""),
    [linkChoice, setLinkChoice] = useState({}),
    [distinct, setDistinct] = useState({}),
    [assign, setAssign] = useState({}),
    [remember, setRemember] = useState({});
  async function refresh() {
    try {
      setStatus(await api("status"));
      setStatusError("");
    } catch (e) {
      setStatusError(
        "No pudimos consultar la conexión. Puedes seguir importando un archivo o texto en este dispositivo.",
      );
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
    if (!Array.isArray(result.receipts))
      throw new Error(
        "No pudimos leer la respuesta de comprobantes. Intenta consultar de nuevo.",
      );
    setPageToken(result.nextPageToken);
    let updated = data,
      automatic = 0,
      achieved = false;
    for (const receipt of result.receipts) {
      const matches = possibleReceiptMatches(updated, receipt);
      const goalId = updated.assignments[receipt.patternId],
        goal = updated.goals.find(
          (g) =>
            g.id === goalId && g.provider === receipt.provider && !g.archived,
        );
      if (
        receipt.validated &&
        goal &&
        !updated.importedIds.includes(receipt.id) &&
        !matches.length
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
    try {
      const matches = possibleReceiptMatches(data, receipt);
      const choice = linkChoice[receipt.id];
      if (matches.length && choice !== "new") {
        const match = matches.find(
          (m) => JSON.stringify([m.goalId, m.entryId]) === choice,
        );
        if (!match) {
          notify("Elige el registro existente o indica que es otro depósito.");
          return;
        }
        if (
          !setData(reconcileReceipt(data, receipt, match.goalId, match.entryId))
        )
          return;
        setReceipts((prev) => prev.filter((r) => r.id !== receipt.id));
        notify("Correo vinculado. El monto registrado se mantiene igual.");
        return;
      }
      if (matches.length && !distinct[receipt.id]) {
        notify("Confirma que este correo corresponde a otro depósito.");
        return;
      }
      const goalId =
        assign[receipt.id] ?? data.assignments[receipt.patternId] ?? "";
      const goal = data.goals.find((g) => g.id === goalId);
      if (!goal || goal.archived) {
        notify("Elige una cajita para este depósito.");
        return;
      }
      const next = addReceipt(data, receipt, goalId, {
        allowPossibleDuplicate: matches.length > 0 && distinct[receipt.id],
      });
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
    } catch (error) {
      notify(error.message);
    }
  }
  return (
    <section>
      <div className="section-heading">
        <div>
          <p className="eyebrow">TODO EN SU LUGAR</p>
          <h1>Un correo, un pasito más</h1>
          <p className="muted">
            Importa un comprobante y revísalo. Las conexiones directas son
            opcionales.
          </p>
        </div>
      </div>
      <LocalMailImport
        data={data}
        onSave={setData}
        notify={notify}
        celebrate={celebrate}
        onCreate={onCreate}
      />
      {statusError && (
        <p className="notice" role="status">
          {statusError}
        </p>
      )}
      <div className="connection-grid optional-connections">
        <details
          className="panel"
          open={Boolean(status.gmailConnected || status.gmailConfigured)}
        >
          <summary>
            Gmail directo{" "}
            <span className="badge">
              {status.gmailConnected
                ? "Conectado"
                : status.gmailConfigured
                  ? "Disponible"
                  : "Por habilitar"}
            </span>
          </summary>
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
            <button
              className="primary button-link"
              disabled={busy || !status.gmailConfigured}
              onClick={() => run(connectGmail)}
            >
              Conectar Gmail ↗
            </button>
          )}
          {!status.gmailConfigured && (
            <p className="notice">
              La conexión al buzón aún no está habilitada en esta publicación.
              Mientras tanto, puedes abrir un correo descargado o pegar su texto
              arriba.
            </p>
          )}
          <p className="small-text muted">
            El permiso gmail.readonly permite leer el correo. Cajitas filtra
            comprobantes y no guarda su contenido. La consulta se ejecuta cuando
            presionas el botón.
          </p>
        </details>
        <details
          className="panel"
          open={Boolean(status.bitsoAuthorized || status.bitsoConfigured)}
        >
          <summary>
            Saldo de Bitso{" "}
            <span className="badge">
              {status.bitsoAuthorized
                ? "Consulta habilitada"
                : status.bitsoConfigured
                  ? "Disponible"
                  : "Opcional"}
            </span>
          </summary>
          <span className="connection-icon bitso">↗</span>
          <h2>Saldo de Bitso</h2>
          <p>
            Consulta tu saldo actual con una llave que tenga únicamente el
            permiso “Ver balances”.
          </p>
          <span className="badge">Opcional · sin transferencias</span>
          {!status.bitsoConfigured ? (
            <p className="notice">
              Esta consulta se habilita al configurar el servicio. Tus cajitas y
              comprobantes locales funcionan sin ella.
            </p>
          ) : !status.bitsoAuthorized ? (
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
        </details>
      </div>
      {receipts.length > 0 && (
        <div className="panel receipts">
          <h2>Depósitos por revisar</h2>
          {receipts.map((r) => {
            const matches = possibleReceiptMatches(data, r);
            const newDeposit = !matches.length || linkChoice[r.id] === "new";
            return (
              <article key={r.id}>
                <div>
                  <strong>
                    {money(r.amountCents)} · {r.provider}
                  </strong>
                  <p className="small-text muted">
                    {new Date(r.at).toLocaleDateString("es-MX")} ·{" "}
                    {r.validated
                      ? "patrón validado"
                      : "patrón pendiente de validar"}
                  </p>
                </div>
                {matches.length > 0 && (
                  <div className="receipt-match">
                    <p>
                      <strong>Puede que ya lo hayas registrado.</strong>{" "}
                      Encontramos el mismo monto, app y día. Revisa tu
                      comprobante: la coincidencia no lo confirma.
                    </p>
                    <label>
                      ¿Ya lo registraste?
                      <select
                        value={linkChoice[r.id] ?? ""}
                        onChange={(e) =>
                          setLinkChoice({
                            ...linkChoice,
                            [r.id]: e.target.value,
                          })
                        }
                      >
                        <option value="">Elige cómo revisar este correo</option>
                        {matches.map((m) => (
                          <option
                            key={JSON.stringify([m.goalId, m.entryId])}
                            value={JSON.stringify([m.goalId, m.entryId])}
                          >
                            {m.goalName} ·{" "}
                            {new Date(m.at).toLocaleTimeString("es-MX", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}{" "}
                            · {money(r.amountCents)}
                          </option>
                        ))}
                        <option value="new">Es otro depósito</option>
                      </select>
                    </label>
                    {linkChoice[r.id] === "new" && (
                      <label className="checkbox">
                        <input
                          type="checkbox"
                          checked={distinct[r.id] ?? false}
                          onChange={(e) =>
                            setDistinct({
                              ...distinct,
                              [r.id]: e.target.checked,
                            })
                          }
                        />
                        Confirmo que es un depósito distinto a los registros
                        sugeridos
                      </label>
                    )}
                  </div>
                )}
                {newDeposit && (
                  <>
                    <label>
                      Cajita
                      <select
                        aria-label="Cajita"
                        value={
                          assign[r.id] ?? data.assignments[r.patternId] ?? ""
                        }
                        onChange={(e) =>
                          setAssign({ ...assign, [r.id]: e.target.value })
                        }
                      >
                        <option value="">Selecciona una cajita</option>
                        {data.goals
                          .filter(
                            (g) => g.provider === r.provider && !g.archived,
                          )
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
                  </>
                )}
                <div className="button-row">
                  <button className="primary" onClick={() => accept(r)}>
                    {matches.length && !newDeposit
                      ? "Vincular al registro existente"
                      : "Confirmar depósito"}
                  </button>
                  <button
                    className="text-button"
                    onClick={() => {
                      if (
                        !setData({
                          ...data,
                          importedIds: [...data.importedIds, r.id],
                        })
                      )
                        return;
                      setReceipts((prev) => prev.filter((x) => x.id !== r.id));
                    }}
                  >
                    Ignorar
                  </button>
                </div>
              </article>
            );
          })}
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
