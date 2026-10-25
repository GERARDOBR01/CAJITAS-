import { useState } from "react";
import { saveFile } from "../platform.js";
import { balance, money, today, validateBackup } from "../domain.js";
import Illustration from "./Illustration.jsx";
import Modal from "./Modal.jsx";

export default function Backup({ data, onRestore, notify }) {
  const [pending, setPending] = useState(null),
    [restoring, setRestoring] = useState(false);
  async function download() {
    try {
      await saveFile(JSON.stringify(data, null, 2), `cajitas-${today()}.json`);
      notify("Respaldo listo. Guárdalo en un lugar privado.");
    } catch (e) {
      notify(e.message);
    }
  }
  async function read(e) {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    try {
      if (file.size > 5e6)
        throw new Error("El respaldo debe pesar menos de 5 MB.");
      let parsed;
      try {
        parsed = JSON.parse(await file.text());
      } catch {
        // Each browser words this differently, and always in English.
        throw new Error(
          "Ese archivo no es un respaldo de Guardadito o está incompleto.",
        );
      }
      setPending(validateBackup(parsed));
    } catch (err) {
      notify(err.message);
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
        <Illustration kind="backup" className="backup-illustration" />
        <h2>Un lugar seguro para tus sueños</h2>
        <p>
          Tus metas, compañeros y movimientos se guardan en este dispositivo.
          Descarga un respaldo antes de cambiar de dispositivo o borrar sus
          datos.
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
          Incluye metas, mascota, visitas, movimientos y correos ya revisados.
          No incluye contraseñas ni conexiones. El archivo contiene información
          de tu ahorro: guárdalo en privado.
        </p>
      </div>
      {pending && (
        <Modal
          title="Revisar respaldo"
          onClose={() => {
            if (!restoring) setPending(null);
          }}
        >
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
            disabled={restoring}
            onClick={async () => {
              setRestoring(true);
              try {
                if ((await onRestore(pending)) !== false) setPending(null);
              } catch (error) {
                notify(error.message);
              } finally {
                setRestoring(false);
              }
            }}
          >
            {restoring
              ? "Restaurando respaldo…"
              : "Reemplazar con este respaldo"}
          </button>
          <button
            className="secondary full"
            disabled={restoring}
            onClick={() => setPending(null)}
          >
            Cancelar
          </button>
        </Modal>
      )}
    </section>
  );
}
