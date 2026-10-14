import { useState } from "react";
import Modal from "./Modal.jsx";
import { cents, localDate, money, today } from "../domain.js";

export default function CorrectEntry({
  goal,
  entry,
  onSave,
  onRemove,
  onClose,
}) {
  const originalDate = localDate(new Date(entry.at));
  const [amount, setAmount] = useState(
    (Math.abs(entry.cents) / 100).toFixed(2),
  );
  const [date, setDate] = useState(originalDate);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState("");
  function submit(e) {
    e.preventDefault();
    try {
      if (removing) {
        onRemove();
        return;
      }
      if (!date || date > today())
        throw new Error("La fecha debe ser de hoy o anterior.");
      const at =
        date === originalDate
          ? entry.at
          : date === today()
            ? new Date().toISOString()
            : new Date(`${date}T12:00:00`).toISOString();
      onSave({ cents: cents(amount) * Math.sign(entry.cents), at });
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <Modal
      title={removing ? "¿Eliminar este registro?" : "Corregir un pasito"}
      onClose={onClose}
    >
      <p className="muted">
        {goal.name} · {entry.cents > 0 ? "Depósito" : "Retiro"}
      </p>
      <form onSubmit={submit}>
        {removing ? (
          <p>
            Se quitará el registro de{" "}
            <strong>{money(Math.abs(entry.cents))}</strong> del{" "}
            {new Date(entry.at).toLocaleDateString("es-MX")}. El dinero en{" "}
            {goal.provider} no cambia.
          </p>
        ) : (
          <>
            <label>
              Monto corregido (MXN)
              <input
                type="number"
                min="0.01"
                max="1000000000"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                autoFocus
              />
            </label>
            <label>
              Fecha del movimiento
              <input
                type="date"
                max={today()}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </label>
            <p className="notice">
              Corrige un error de captura. Para registrar un retiro real, usa
              Registrar retiro en tu cajita.
            </p>
          </>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className={`${removing ? "danger" : "primary"} full`}>
          {removing ? "Sí, eliminar registro" : "Guardar corrección"}
        </button>
        <button
          className="text-button full"
          type="button"
          onClick={() => {
            setRemoving(!removing);
            setError("");
          }}
        >
          {removing ? "Volver a corregir" : "Eliminar registro equivocado"}
        </button>
      </form>
    </Modal>
  );
}
