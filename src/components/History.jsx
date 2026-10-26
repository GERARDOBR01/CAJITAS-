import {
  activity,
  activityCSV,
  moneyShort as money,
  trashItems,
  TRASH_DAYS,
} from "../domain.js";
import { saveFile } from "../platform.js";
import { Pen } from "./icons.jsx";

const monthLabel = new Intl.DateTimeFormat("es-MX", {
  month: "long",
  year: "numeric",
});
const dayLabel = (at) =>
  new Date(at).toLocaleDateString("es-MX", { day: "numeric", month: "short" });

/** Every movement, newest first and grouped by month, plus the trash. */
export default function History({ data, notify, onCorrect, onRestore }) {
  const entries = activity(data),
    trash = trashItems(data);
  const months = [];
  for (const entry of entries) {
    const label = monthLabel.format(new Date(entry.at));
    if (months.at(-1)?.label !== label) months.push({ label, entries: [] });
    months.at(-1).entries.push(entry);
  }
  return (
    <section className="history" aria-labelledby="history-title">
      <h1 id="history-title">Historial</h1>
      {entries.length ? (
        months.map((month) => (
          <section key={month.label} className="history-month">
            <h2>{month.label}</h2>
            <ul className="movement-list">
              {month.entries.map((e) => (
                <li key={`${e.goalId}:${e.id}`}>
                  <span>
                    <strong>{e.goalName}</strong>
                    <small>
                      {dayLabel(e.at)}
                      {e.source === "guardian" && " · con tu guardián"}
                    </small>
                  </span>
                  <strong className={e.cents > 0 ? "plus" : "minus"}>
                    {e.cents > 0 ? "+" : ""}
                    {money(e.cents)}
                  </strong>
                  {e.source === "manual" && (
                    <button
                      className="edit-entry"
                      aria-label={`Corregir registro de ${e.goalName} del ${new Date(e.at).toLocaleDateString("es-MX")}`}
                      onClick={() => onCorrect(e)}
                    >
                      <Pen />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))
      ) : (
        <p className="history-empty">Aquí aparecerá cada pasito que guardes.</p>
      )}
      {trash.length > 0 && (
        <details className="history-trash">
          <summary>Papelera ({trash.length})</summary>
          <p className="small-text muted">
            Lo que borras se queda aquí {TRASH_DAYS} días.
          </p>
          <ul className="movement-list">
            {trash.map((t) => (
              <li key={t.entry.id}>
                <span>
                  <strong>{t.goalName}</strong>
                  <small>{dayLabel(t.entry.at)}</small>
                </span>
                <strong>
                  {t.entry.cents > 0 ? "+" : ""}
                  {money(t.entry.cents)}
                </strong>
                <button
                  className="text-button restore"
                  onClick={() => onRestore(t.entry.id)}
                >
                  Restaurar
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
      {entries.length > 0 && (
        <button
          className="text-button"
          onClick={async () => {
            try {
              await saveFile(
                activityCSV(data),
                "guardadito-movimientos.csv",
                "text/csv;charset=utf-8",
              );
              notify("Movimientos descargados.");
            } catch (e) {
              notify(e.message);
            }
          }}
        >
          Descargar en Excel (CSV)
        </button>
      )}
    </section>
  );
}
