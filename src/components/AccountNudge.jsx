import { useState } from "react";

const DISMISSED_KEY = "guardadito:account-nudge";

function dismissed() {
  try {
    return localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * After the first cajita, a gentle reminder that without an account
 * everything lives only in this phone (and Safari may clear it).
 */
export default function AccountNudge({ show, goals, onAccount }) {
  const [hidden, setHidden] = useState(dismissed);
  if (!show || hidden || goals < 1) return null;
  function close() {
    setHidden(true);
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      /* It shows again next time; that is all. */
    }
  }
  return (
    <aside className="account-nudge" aria-label="Respalda tus cajitas">
      <span aria-hidden="true">☁</span>
      <div>
        <strong>Que no se pierdan tus cajitas</strong>
        <p>
          Hoy viven solo en este teléfono. Con una cuenta gratis las recuperas
          si lo cambias o borras el navegador.
        </p>
        <div className="button-row">
          <button className="primary" onClick={onAccount}>
            Crear mi cuenta
          </button>
          <button className="text-button" onClick={close}>
            Ahora no
          </button>
        </div>
      </div>
    </aside>
  );
}
