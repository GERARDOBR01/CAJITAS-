import { useEffect, useState } from "react";
import { api } from "../platform.js";
import { cents, estimate, money } from "../domain.js";

export default function Simulator() {
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
