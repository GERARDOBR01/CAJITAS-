import { useEffect, useState } from "react";
import { isNative } from "../platform.js";

const push = () => import("../cloud/push.js");

/** Notices on this phone: what the partner does, even with the app closed. */
export default function Notices({ pairId, uid, name, notify }) {
  const [state, setState] = useState("loading"),
    [on, setOn] = useState(false),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    push()
      .then(async ({ pushState, refreshPush }) => {
        const current = pushState();
        const registered =
          current === "granted" &&
          (await refreshPush(pairId, uid).catch(() => false));
        if (alive) {
          setState(current);
          setOn(registered);
        }
      })
      .catch(() => alive && setState("unsupported"));
    return () => {
      alive = false;
    };
  }, [pairId, uid]);
  async function toggle(enable) {
    setBusy(true);
    try {
      const lib = await push();
      if (enable) await lib.enablePush(pairId, uid);
      else await lib.disablePush(pairId);
      setOn(enable);
      setState(lib.pushState());
      notify(
        enable
          ? "Listo: este teléfono te avisará 🔔"
          : "Este teléfono ya no recibirá avisos.",
      );
    } catch (error) {
      notify(error.message || "No se pudieron activar los avisos.");
      push().then((lib) => setState(lib.pushState()));
    } finally {
      setBusy(false);
    }
  }
  if (state === "loading") return null;
  return (
    <div className="panel partner-panel notices">
      <h2>🔔 Avisos en este teléfono</h2>
      {state === "install" ? (
        <>
          <p className="muted">
            En iPhone, los avisos llegan cuando Guardadito está en tu pantalla
            de inicio:
          </p>
          <ol className="install-steps">
            <li>Ábrela en Safari y toca Compartir.</li>
            <li>Elige «Agregar a inicio».</li>
            <li>Ábrela desde el ícono y vuelve aquí.</li>
          </ol>
        </>
      ) : state === "unsupported" ? (
        <p className="muted">
          {isNative
            ? "En la app de Android los avisos llegan pronto. Mientras, los ves aquí al abrirla, y tu pareja sí recibe los tuyos."
            : "Este navegador no puede recibir avisos."}
        </p>
      ) : state === "denied" ? (
        <p className="muted">
          Bloqueaste los avisos. Puedes activarlos en los ajustes del teléfono,
          en Notificaciones.
        </p>
      ) : on ? (
        <>
          <p>✓ Te avisamos aunque tengas la app cerrada.</p>
          <button
            className="text-button"
            disabled={busy}
            onClick={() => toggle(false)}
          >
            Desactivar en este teléfono
          </button>
        </>
      ) : (
        <>
          <p className="muted">
            Te avisamos cuando {name} te mande una sorpresa, confirme un
            depósito o aparte para una cajita de los dos.
          </p>
          <button
            className="primary"
            disabled={busy}
            onClick={() => toggle(true)}
          >
            Activar avisos
          </button>
        </>
      )}
    </div>
  );
}
