import { useState } from "react";
import {
  activity,
  activityCSV,
  balanceHistory,
  money,
  localDate,
  balance,
} from "../domain.js";
import { saveFile } from "../platform.js";
export default function Activity({ data, notify }) {
  const [goalId, setGoalId] = useState(""),
    [month, setMonth] = useState(localDate(new Date()).slice(0, 7));
  const entries = activity(data, { goalId, month }),
    saved = entries.filter((e) => e.cents > 0).reduce((s, e) => s + e.cents, 0),
    withdrawn = -entries
      .filter((e) => e.cents < 0)
      .reduce((s, e) => s + e.cents, 0),
    points = balanceHistory(data),
    maximum = Math.max(1, ...points.map((p) => p.cents));
  const coords = points.map(
      (p, i) =>
        `${25 + i * (550 / (points.length - 1))},${170 - (p.cents / maximum) * 130}`,
    ),
    final = coords.at(-1)?.split(",");
  return (
    <section>
      <div className="section-heading">
        <div>
          <p className="eyebrow">CADA PASITO TIENE HISTORIA</p>
          <h1>Así van tus guardaditos</h1>
          <p className="muted">
            Tus movimientos reales registrados, en un solo lugar.
          </p>
        </div>
        <button
          className="secondary"
          disabled={!entries.length}
          onClick={async () => {
            try {
              await saveFile(
                activityCSV(data, { goalId, month }),
                `cajitas-movimientos-${month || "todos"}.csv`,
                "text/csv;charset=utf-8",
              );
              notify("Movimientos exportados.");
            } catch (e) {
              notify(e.message);
            }
          }}
        >
          ↓ Exportar CSV
        </button>
      </div>
      <div className="panel chart-panel">
        <div className="chart-heading">
          <div>
            <p className="eyebrow">ÚLTIMOS 14 DÍAS</p>
            <h2>Un poquito más cerca</h2>
          </div>
          <strong>
            {money(data.goals.reduce((s, g) => s + balance(g), 0))}
            <small>Total registrado · incluye archivadas</small>
          </strong>
        </div>
        <svg
          viewBox="0 0 600 205"
          className="savings-chart"
          role="img"
          aria-label={`Historial del ahorro registrado de los últimos 14 días. Último saldo ${money(points.at(-1).cents)}`}
        >
          <defs>
            <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#c7deb4" stopOpacity=".65" />
              <stop offset="1" stopColor="#eaf1e1" stopOpacity=".08" />
            </linearGradient>
          </defs>
          {[40, 105, 170].map((y) => (
            <line
              key={y}
              x1="25"
              y1={y}
              x2="575"
              y2={y}
              stroke="#e7ebdf"
              strokeDasharray="4 5"
            />
          ))}
          <path
            d={`M25 170 L${coords.join(" L")} L575 170Z`}
            fill="url(#chart-fill)"
          />
          <polyline
            points={coords.join(" ")}
            stroke="#8fae7b"
            strokeWidth="3"
            fill="none"
            strokeLinejoin="round"
          />
          {final && (
            <circle
              cx={final[0]}
              cy={final[1]}
              r="5"
              fill="#648454"
              stroke="white"
              strokeWidth="2"
            />
          )}
          <text x="25" y="198" fill="#87947d" fontSize="11">
            {points[0].date.slice(5)}
          </text>
          <text x="575" y="198" textAnchor="end" fill="#87947d" fontSize="11">
            Hoy
          </text>
        </svg>
        <details>
          <summary>Ver los valores del historial</summary>
          <table className="history-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Ahorro registrado</th>
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.date}>
                  <td>{p.date}</td>
                  <td>{money(p.cents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </div>
      <div className="activity-filters form-row">
        <label>
          Cajita
          <select value={goalId} onChange={(e) => setGoalId(e.target.value)}>
            <option value="">Todas mis cajitas</option>
            {data.goals.map((g) => (
              <option value={g.id} key={g.id}>
                {g.name}
                {g.archived ? " · archivada" : ""}
              </option>
            ))}
          </select>
        </label>
        <label>
          Mes
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </label>
      </div>
      <div className="stats activity-stats">
        <div>
          <span className="stat-icon lavender">↗</span>
          <p>
            <strong>{money(saved)}</strong>
            <span>Depósitos del periodo</span>
          </p>
        </div>
        <div>
          <span className="stat-icon peach">↙</span>
          <p>
            <strong>{money(withdrawn)}</strong>
            <span>Retiros del periodo</span>
          </p>
        </div>
        <div>
          <span className="stat-icon yellow">✦</span>
          <p>
            <strong>{entries.length}</strong>
            <span>Pasitos registrados</span>
          </p>
        </div>
      </div>
      <div className="panel activity-feed">
        <h2>Tu historia</h2>
        {entries.length ? (
          <ol>
            {entries.map((e) => (
              <li key={`${e.goalId}:${e.id}`}>
                <span
                  className={`movement-icon ${e.cents > 0 ? "deposit" : "withdrawal"}`}
                >
                  {e.cents > 0 ? "↗" : "↙"}
                </span>
                <div>
                  <strong>{e.goalName}</strong>
                  <span>
                    {new Date(e.at).toLocaleDateString("es-MX", {
                      day: "numeric",
                      month: "short",
                    })}{" "}
                    ·{" "}
                    {e.source === "gmail"
                      ? "Correo confirmado"
                      : "Registro manual"}{" "}
                    · {e.provider}
                  </span>
                </div>
                <strong className={e.cents > 0 ? "deposit-amount" : ""}>
                  {e.cents > 0 ? "+" : ""}
                  {money(e.cents)}
                </strong>
              </li>
            ))}
          </ol>
        ) : (
          <div className="activity-empty">
            <span>☁</span>
            <p>Tu historia está por empezar.</p>
            <small>Cuando registres un movimiento aparecerá aquí.</small>
          </div>
        )}
      </div>
    </section>
  );
}
