import { useRef, useState } from "react";
import Illustration from "./Illustration.jsx";
import { parseLocalEmail, MAX_EMAIL_BYTES } from "../mail/parseEmail.js";
import {
  applyLocalReceipt,
  possibleLocalMatches,
} from "../receipts/local.js";
import { cents, localDate, money, today } from "../domain.js";

export default function LocalMailImport({
  data,
  record,
  notify,
  initialGoalId = "",
  onDone,
  onCreate,
  compact = false,
}) {
  const [mode, setMode] = useState("file"),
    [pasted, setPasted] = useState(""),
    [candidate, setCandidate] = useState(null),
    [goalId, setGoalId] = useState(initialGoalId),
    [amount, setAmount] = useState(""),
    [date, setDate] = useState(""),
    [choice, setChoice] = useState(""),
    [distinct, setDistinct] = useState(false),
    [reviewed, setReviewed] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false);
  const requestId = useRef(0),
    reviewRef = useRef();
  const goals = data.goals.filter((g) => !g.archived),
    goal = data.goals.find((g) => g.id === goalId);
  function changed(setter, value) {
    setter(value);
    setReviewed(false);
    setChoice("");
    setDistinct(false);
    setError("");
  }
  let receipt = null,
    matches = [];
  if (candidate && goal && date) {
    try {
      const at =
        candidate.at && localDate(new Date(candidate.at)) === date
          ? candidate.at
          : date === today()
            ? new Date().toISOString()
            : new Date(`${date}T12:00:00`).toISOString();
      receipt = {
        id: candidate.id,
        provider: goal.provider,
        amountCents: cents(amount),
        at,
      };
      matches = possibleLocalMatches(data, receipt);
    } catch {
      receipt = null;
    }
  }
  async function analyze(input, format) {
    const id = ++requestId.current;
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      const result = await parseLocalEmail(input, { format });
      if (id !== requestId.current) return;
      if (data.importedIds.includes(result.id))
        throw new Error(
          "Este correo ya fue revisado e importado. No se agregó otro depósito.",
        );
      setCandidate(result);
      setAmount(
        result.amountCents ? (result.amountCents / 100).toFixed(2) : "",
      );
      setDate(result.at ? localDate(new Date(result.at)) : "");
      setChoice("");
      setDistinct(false);
      setReviewed(false);
      setPasted("");
      requestAnimationFrame(() =>
        reviewRef.current?.scrollIntoView({
          behavior: "instant",
          block: "start",
        }),
      );
    } catch (e) {
      if (id === requestId.current) {
        setCandidate(null);
        setError(e.message);
      }
    } finally {
      if (id === requestId.current) setBusy(false);
    }
  }
  function submit(e) {
    e.preventDefault();
    setError("");
    try {
      if (!receipt || !goal || goal.archived)
        throw new Error(
          "Revisa la cajita, el monto y la fecha antes de continuar.",
        );
      if (!reviewed) throw new Error("Confirma que revisaste el comprobante.");
      let match;
      if (matches.length && choice !== "new") {
        match = matches.find(
          (m) => JSON.stringify([m.goalId, m.entryId]) === choice,
        );
        if (!match)
          throw new Error(
            "Elige el movimiento existente o indica que es otro depósito.",
          );
      }
      if (matches.length && choice === "new" && !distinct)
        throw new Error("Confirma que se trata de otro depósito.");
      const next = applyLocalReceipt(data, receipt, {
        goalId,
        match,
        allowDuplicate: matches.length > 0 && choice === "new" && distinct,
      });
      if (next === data) {
        setSaved(true);
        setCandidate(null);
        notify("Este correo ya estaba registrado. No se volvió a sumar.");
        return;
      }
      if (
        !record(
          data,
          next,
          match
            ? "Comprobante vinculado. El monto registrado se mantiene igual."
            : "Depósito revisado y registrado. El correo quedó en tu dispositivo.",
        )
      )
        return;
      setCandidate(null);
      setSaved(true);
      setReviewed(false);
      onDone?.();
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <section
      className={`panel local-mail ${compact ? "local-mail-compact" : ""}`}
      aria-label="Importar comprobante local"
    >
      <div className="local-mail-heading">
        <Illustration kind="mail" />
        <div>
          <p className="eyebrow">UN COMPROBANTE, UN PASITO</p>
          <h2>Importar un correo</h2>
          <p>
            Abre un archivo o pega el texto. Revisa los datos antes de registrar
            el depósito.
          </p>
          <span className="badge">Funciona aquí · sin conectar Gmail</span>
        </div>
      </div>
      <p className="local-mail-privacy">
        El correo se procesa en este dispositivo, sin enviarlo a un servidor. Se
        guardan solo el movimiento confirmado y una huella para reconocer el
        correo; su contenido se descarta.
      </p>
      {!candidate && !saved && (
        <>
          <div
            className="local-mail-modes"
            role="group"
            aria-label="Cómo traer el correo"
          >
            <button
              className="secondary"
              aria-pressed={mode === "file"}
              onClick={() => setMode("file")}
            >
              Abrir archivo .eml
            </button>
            <button
              className="secondary"
              aria-pressed={mode === "text"}
              onClick={() => setMode("text")}
            >
              Pegar texto del correo
            </button>
          </div>
          {mode === "file" ? (
            <label className={`mail-file-drop ${busy ? "disabled" : ""}`}>
              <span aria-hidden="true">✉</span>
              <strong>Elegir un correo descargado</strong>
              <span>.eml o .txt · máximo 2 MB</span>
              <input
                aria-label="Archivo del correo"
                type="file"
                accept=".eml,.txt,message/rfc822,text/plain"
                disabled={busy}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  if (file.size > MAX_EMAIL_BYTES) {
                    setError("El correo debe pesar como máximo 2 MB.");
                    return;
                  }
                  analyze(
                    file,
                    file.name.toLowerCase().endsWith(".txt") ? "text" : "eml",
                  );
                }}
              />
            </label>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                analyze(pasted, "text");
              }}
            >
              <label>
                Texto del comprobante
                <textarea
                  value={pasted}
                  maxLength={MAX_EMAIL_BYTES}
                  required
                  rows={6}
                  placeholder="Pega el texto del depósito. Puedes borrar nombres, cuentas y referencias que no necesites."
                  onChange={(e) => setPasted(e.target.value)}
                />
              </label>
              <button className="primary" disabled={busy || !pasted.trim()}>
                Revisar texto
              </button>
            </form>
          )}
          <details className="mail-howto">
            <summary>¿Cómo traigo un correo de Gmail?</summary>
            <ol>
              <li>En computadora, abre el correo en Gmail.</li>
              <li>
                En el menú de tres puntos del mensaje, elige Descargar mensaje.
              </li>
              <li>
                Abre el archivo .eml aquí. En el celular puedes copiar y pegar
                el texto.
              </li>
            </ol>
            <p>
              No hace falta conectar el buzón. Un archivo exportado no verifica
              quién lo envió; revisa el depósito en tu app externa.
            </p>
          </details>
        </>
      )}
      {busy && (
        <p role="status">Abriendo tu comprobante en este dispositivo…</p>
      )}
      {candidate && (
        <form ref={reviewRef} className="mail-review" onSubmit={submit}>
          <h3>Revisar comprobante</h3>
          <p className="notice">
            No verificamos el remitente de un archivo o texto pegado. Nada se
            registra hasta que lo confirmes.
          </p>
          {(candidate.subject || candidate.from) && (
            <div className="mail-metadata">
              {candidate.subject && (
                <p>
                  <strong>Asunto:</strong> {candidate.subject}
                </p>
              )}
              {candidate.from && (
                <p>
                  <strong>Remitente indicado:</strong> {candidate.from}
                </p>
              )}
            </div>
          )}
          {candidate.warnings.length > 0 && (
            <ul className="mail-warnings">
              {candidate.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          )}
          <details className="mail-preview">
            <summary>Ver texto leído</summary>
            <pre>{candidate.preview}</pre>
          </details>
          <label>
            Cajita para este comprobante
            <select
              value={goalId}
              required
              onChange={(e) => changed(setGoalId, e.target.value)}
            >
              <option value="">Elige una cajita</option>
              {goals.map((g) => (
                <option value={g.id} key={g.id}>
                  {g.name} · {g.provider}
                </option>
              ))}
            </select>
          </label>
          {!goals.length && (
            <p className="notice">
              Primero crea una cajita para guardar el registro.{" "}
              {onCreate && (
                <button
                  type="button"
                  className="text-button"
                  onClick={onCreate}
                >
                  Crear cajita
                </button>
              )}
            </p>
          )}
          <div className="form-row">
            <label>
              Monto revisado (MXN)
              <input
                type="number"
                min="0.01"
                max="1000000000"
                step="0.01"
                value={amount}
                required
                onChange={(e) => changed(setAmount, e.target.value)}
              />
            </label>
            <label>
              Fecha real del depósito
              <input
                type="date"
                value={date}
                max={today()}
                required
                onChange={(e) => changed(setDate, e.target.value)}
              />
            </label>
          </div>
          {matches.length > 0 && (
            <div className="receipt-match">
              <p>
                <strong>Puede que ya lo hayas registrado.</strong> Coinciden
                monto, app y día; elige qué corresponde.
              </p>
              <label>
                Este correo corresponde a
                <select
                  value={choice}
                  required
                  onChange={(e) => {
                    setChoice(e.target.value);
                    setReviewed(false);
                    setDistinct(false);
                  }}
                >
                  <option value="">Revisar coincidencias</option>
                  {matches.map((m) => (
                    <option
                      key={JSON.stringify([m.goalId, m.entryId])}
                      value={JSON.stringify([m.goalId, m.entryId])}
                    >
                      {m.goalName}
                      {m.archived ? " · archivada" : ""} ·{" "}
                      {money(receipt.amountCents)}
                    </option>
                  ))}
                  <option value="new">Es otro depósito</option>
                </select>
              </label>
              {choice === "new" && (
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={distinct}
                    required
                    onChange={(e) => setDistinct(e.target.checked)}
                  />
                  Confirmo que es distinto a los movimientos sugeridos
                </label>
              )}
            </div>
          )}
          <label className="checkbox mail-confirm">
            <input
              type="checkbox"
              checked={reviewed}
              required
              onChange={(e) => setReviewed(e.target.checked)}
            />
            {matches.length && choice && choice !== "new"
              ? "Revisé los datos y es el mismo depósito del movimiento seleccionado"
              : "Revisé monto y fecha; este depósito ya ocurrió en mi app externa"}
          </label>
          <div className="button-row">
            <button className="primary" disabled={!goals.length}>
              {matches.length && choice && choice !== "new"
                ? "Vincular comprobante sin sumar"
                : "Confirmar e importar depósito"}
            </button>
            <button
              className="text-button"
              type="button"
              onClick={() => {
                setCandidate(null);
                setPasted("");
                setError("");
                setReviewed(false);
              }}
            >
              Descartar revisión
            </button>
          </div>
        </form>
      )}
      {saved && (
        <div className="mail-success" role="status">
          <span aria-hidden="true">✿</span>
          <h3>Un pasito en su lugar</h3>
          <p>Tu registro ya está actualizado. Puedes verlo en Actividad.</p>
          <button
            className="secondary"
            onClick={() => {
              setSaved(false);
              setError("");
            }}
          >
            Importar otro correo
          </button>
        </div>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
