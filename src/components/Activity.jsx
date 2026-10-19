import { useState } from "react";
import {
  activity,
  activityCSV,
  balanceHistory,
  money,
  localDate,
  balance,
  trashItems,
  TRASH_DAYS,
} from "../domain.js";
import { saveFile } from "../platform.js";
import Illustration from "./Illustration.jsx";
export default function Activity({ data, notify, onCorrect, onRestore }) {
  const [goalId, setGoalId] = useState(""),
    [month, setMonth] = useState(localDate(new Date()).slice(0, 7));
  const trash = trashItems(data);
  const entries = activity(data, { goalId, month }),
    saved = entries.filter((e) => e.cents > 0).reduce((s, e) => s + e.cents, 0),
    withdrawn = -entries
      .filter((e) => e.cents < 0)
      .reduce((s, e) => s + e.cents, 0),
    chartData = {
      ...data,
      goals: data.goals.filter((g) => !goalId || g.id === goalId),
    },
    points = balanceHistory(chartData),
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
            Lo que has registrado, en un solo lugar. Puedes corregir errores de
            captura.
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
            {money(chartData.goals.reduce((s, g) => s + balance(g), 0))}
            <small>
              {goalId
                ? "Total registrado de esta cajita"
                : "Total registrado · incluye archivadas"}
            </small>
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
              <stop offset="0" stopColor="var(--primary)" stopOpacity=".3" />
              <stop offset="1" stopColor="var(--primary)" stopOpacity=".02" />
            </linearGradient>
          </defs>
          {[40, 105, 170].map((y) => (
            <line
              key={y}
              x1="25"
              y1={y}
              x2="575"
              y2={y}
              stroke="var(--line)"
              strokeDasharray="4 5"
            />
          ))}
          <path
            d={`M25 170 L${coords.join(" L")} L575 170Z`}
            fill="url(#chart-fill)"
          />
          <polyline
            points={coords.join(" ")}
            stroke="var(--primary)"
            strokeWidth="3"
            fill="none"
            strokeLinejoin="round"
          />
          {final && (
            <circle
              cx={final[0]}
              cy={final[1]}
              r="5"
              fill="var(--primary)"
              stroke="var(--surface)"
              strokeWidth="2"
            />
          )}
        </svg>
        <div className="chart-axis">
          <span>{points[0].date.slice(5)}</span>
          <span>Hoy</span>
        </div>
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
                      : e.source === "guardian"
                        ? "Confirmado por tu guardián"
                        : "Registro manual"}{" "}
                    · {e.provider}
                  </span>
                </div>
                <strong className={e.cents > 0 ? "deposit-amount" : ""}>
                  {e.cents > 0 ? "+" : ""}
                  {money(e.cents)}
                </strong>
                {e.source === "manual" && (
                  <button
                    className="text-button correct-entry"
                    aria-label={`Corregir registro de ${e.goalName} del ${new Date(e.at).toLocaleDateString("es-MX")}`}
                    onClick={() => onCorrect(e)}
                  >
                    Corregir
                  </button>
                )}
              </li>
            ))}
          </ol>
        ) : (
          <div className="activity-empty">
            <Illustration kind="activity" />
            <p>Tu historia está por empezar.</p>
            <small>Cuando registres un movimiento aparecerá aquí.</small>
          </div>
        )}
      </div>
      {trash.length > 0 && (
        <details className="panel trash">
          <summary>🗑 Papelera ({trash.length})</summary>
          <p className="small-text muted">
            Lo que borras se guarda aquí {TRASH_DAYS} días por si te
            equivocaste.
          </p>
          <ul className="partner-list" aria-label="Papelera">
            {trash.map((t) => (
              <li key={t.entry.id}>
                <span>
                  <strong>
                    {t.entry.cents > 0 ? "+" : ""}
                    {money(t.entry.cents)} · {t.goalName}
                  </strong>
                  <small>
                    {new Date(t.entry.at).toLocaleDateString("es-MX", {
                      day: "numeric",
                      month: "short",
                    })}{" "}
                    · borrado el{" "}
                    {new Date(t.deletedAt).toLocaleDateString("es-MX", {
                      day: "numeric",
                      month: "short",
                    })}
                  </small>
                </span>
                <button
                  className="secondary"
                  onClick={() => onRestore(t.entry.id)}
                >
                  Restaurar
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
